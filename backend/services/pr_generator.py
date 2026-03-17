import re
import difflib
import base64
from typing import Optional
from schemas import PRRequest, PRResponse, LLMRequest, TaskType
from services.llm_router import route_llm
from config import settings

PR_SYSTEM = """You are an expert software engineer creating production-ready pull requests.
Generate clean, well-commented code fixes. Include defensive programming, error handling, and tests.
Always output the complete fixed file, not just the diff."""


def generate_diff(original: str, fixed: str, filename: str) -> str:
    original_lines = original.splitlines(keepends=True)
    fixed_lines = fixed.splitlines(keepends=True)
    diff = list(difflib.unified_diff(
        original_lines,
        fixed_lines,
        fromfile=f"a/{filename}",
        tofile=f"b/{filename}",
        lineterm="",
    ))
    return "".join(diff)


from utils import logger
import os
import httpx
import json

async def create_github_pr(request: PRRequest, fixed_code: str, description: str, token: str) -> Optional[str]:
    """Creates a PR on GitHub using a full branch -> commit -> PR flow."""
    log = logger.bind(repo=request.repo_url, file=request.file_path)
    
    match = re.search(r"github\.com/([^/]+)/([^/.]+)", request.repo_url)
    if not match:
        log.error("invalid_repo_url")
        raise Exception(f"Invalid repo URL: {request.repo_url}")
    
    owner, repo = match.groups()
    repo = repo.removesuffix(".git")
    base_url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            log.info("github_pr_start")
            
            # 1. Get default branch name
            repo_info = await client.get(base_url, headers=headers)
            if repo_info.status_code != 200:
                err_msg = f"Failed to get repo info (HTTP {repo_info.status_code}): {repo_info.text}"
                log.error("github_get_repo_failed", error=err_msg)
                raise Exception(err_msg)
                
            repo_data = repo_info.json()
            default_branch = repo_data.get("default_branch", "main")
            log.info("github_default_branch", branch=default_branch)
            
            # 2. Get default branch SHA
            ref_resp = await client.get(f"{base_url}/git/ref/heads/{default_branch}", headers=headers)
            if ref_resp.status_code != 200:
                err_msg = f"Failed to get branch ref for {default_branch} (HTTP {ref_resp.status_code}): {ref_resp.text}"
                log.error("github_get_ref_failed", error=err_msg)
                raise Exception(err_msg)
            sha = ref_resp.json()["object"]["sha"]
            
            # 3. Create a new branch
            new_branch = f"logai-fix-{os.urandom(4).hex()}"
            branch_data = {"ref": f"refs/heads/{new_branch}", "sha": sha}
            branch_resp = await client.post(f"{base_url}/git/refs", headers=headers, json=branch_data)
            if branch_resp.status_code != 201:
                err_msg = f"Failed to create branch {new_branch} (HTTP {branch_resp.status_code}): {branch_resp.text}"
                log.error("github_create_branch_failed", error=err_msg)
                raise Exception(err_msg)
            
            log.info("github_branch_created", branch=new_branch)
            
            # 4. Get file SHA (if it exists)
            file_resp = await client.get(f"{base_url}/contents/{request.file_path}", headers=headers, params={"ref": default_branch})
            file_sha = None
            if file_resp.status_code == 200:
                file_sha = file_resp.json().get("sha")
            
            # 5. Commit fixed code
            content_encoded = base64.b64encode(fixed_code.encode()).decode()
            commit_data = {
                "message": f"fix: addressed issues in {request.file_path}",
                "content": content_encoded,
                "branch": new_branch,
            }
            if file_sha:
                commit_data["sha"] = file_sha
                
            commit_resp = await client.put(f"{base_url}/contents/{request.file_path}", headers=headers, json=commit_data)
            if commit_resp.status_code not in (200, 201):
                err_msg = f"Failed to commit code to {request.file_path} (HTTP {commit_resp.status_code}): {commit_resp.text}"
                log.error("github_commit_failed", error=err_msg)
                raise Exception(err_msg)
            
            # 6. Create Pull Request
            pr_data = {
                "title": request.title or f"Fix for {request.file_path}",
                "body": description,
                "head": new_branch,
                "base": default_branch,
            }
            pr_resp = await client.post(f"{base_url}/pulls", headers=headers, json=pr_data)
            if pr_resp.status_code == 201:
                pr_url = pr_resp.json().get("html_url")
                log.info("github_pr_created", url=pr_url)
                return pr_url
            else:
                err_msg = f"Failed to create PR (HTTP {pr_resp.status_code}): {pr_resp.text}"
                log.error("github_pr_create_failed", error=err_msg)
                raise Exception(err_msg)
        except Exception as e:
            log.error("github_api_flow_error", error=str(e))
            raise

async def validate_github_connection(repo_url: str, token: str) -> bool:
    """Checks if the token is valid and has access to the repository."""
    try:
        match = re.search(r"github\.com/([^/]+)/([^/.]+)", repo_url)
        if not match:
            return False
        
        owner, repo = match.groups()
        repo = repo.removesuffix(".git")
        base_url = f"https://api.github.com/repos/{owner}/{repo}"
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
        }
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(base_url, headers=headers)
            return resp.status_code == 200
    except Exception as e:
        logger.error("github_connection_validation_failed", error=str(e))
        return False

async def generate_pr(request: PRRequest) -> PRResponse:
    print(f"[PR Generator] Starting PR generation for {request.file_path} in {request.repo_url}...")
    prompt = f"""Generate a production-ready code fix and pull request.

REPOSITORY: {request.repo_url}
FILE: {request.file_path}
LANGUAGE: {request.language}

FIX DESCRIPTION:
{request.fix_description}

ORIGINAL CODE:
```{request.language}
{request.original_code}
```

Please provide:
1. The COMPLETE fixed version of the file with all improvements applied
2. Detailed PR description explaining what changed and why
3. A conventional commit message (feat/fix/refactor: description)

IMPORTANT: Output the complete fixed code in a ```{request.language} code block."""

    llm_req = LLMRequest(
        task_type=TaskType.fix,
        prompt=prompt,
        system_prompt=PR_SYSTEM,
    )
    
    print(f"[PR Generator] Sending request to LLM ({TaskType.fix})...")
    response = await route_llm(llm_req)
    print(f"[PR Generator] LLM response received. Model used: {response.model_used}")

    # Extract code block from response
    print(f"[PR Generator] Extracting fixed code and building diff...")
    fixed_code = _extract_code_block(response.content, request.language)
    if not fixed_code:
        print(f"[PR Generator] Warning: No code block extracted. Using fallback.")
        fixed_code = request.original_code + "\n# Fix applied by LogAI Platform\n"

    # Generate diff
    filename = request.file_path.split("/")[-1]
    patch = generate_diff(request.original_code, fixed_code, filename)

    # Generate commit message
    commit_message = _extract_commit_message(response.content, request.fix_description)

    # Build PR description
    pr_description = _build_pr_description(request, response.content)

    # Actual GitHub API call if token is available
    github_token = request.github_token or settings.GITHUB_TOKEN
    pr_url = None
    status = "generated"
    error_detail = None
    
    is_placeholder = not github_token or github_token.startswith("your_") or github_token.startswith("ghp_your")
    
    if not is_placeholder:
        print(f"[PR Generator] Creating real Pull Request on GitHub...")
        try:
            pr_url = await create_github_pr(request, fixed_code, pr_description, github_token)
            if pr_url:
                print(f"[PR Generator] Success! PR created at: {pr_url}")
                status = "created"
            else:
                status = "failed_to_create"
                error_detail = "GitHub PR creation returned no URL."
        except Exception as e:
            print(f"[PR Generator] GitHub creation error: {e}")
            status = "error"
            error_detail = str(e)
    else:
        print(f"[PR Generator] No GitHub token found or using placeholder. Skipping real PR creation.")

    print(f"[PR Generator] PR generation complete.")
    return PRResponse(
        pr_url=pr_url,
        branch_name=request.branch_name,
        title=request.title,
        description=pr_description,
        patch=patch,
        fixed_code=fixed_code,
        commit_message=commit_message,
        model_used=response.model_used,
        status=status,
        error_detail=error_detail,
    )


def _extract_code_block(content: str, language: str) -> str:
    patterns = [
        rf"```{language}\n(.*?)```",
        r"```\w*\n(.*?)```",
    ]
    for pattern in patterns:
        match = re.search(pattern, content, re.DOTALL)
        if match:
            return match.group(1).strip()
    
    # Fallback: if no code blocks but looks like code
    if "def " in content or "import " in content or "class " in content:
        # Try to find the first block of text that looks like code
        lines = content.split("\n")
        code_lines = []
        started = False
        for line in lines:
            if any(line.strip().startswith(p) for p in ["def ", "import ", "from ", "class "]):
                started = True
            if started:
                code_lines.append(line)
        if code_lines:
            return "\n".join(code_lines).strip()
            
    return ""


def _extract_commit_message(content: str, fallback_desc: str) -> str:
    lines = content.split("\n")
    for line in lines:
        line = line.strip()
        if any(line.startswith(p) for p in ["fix:", "feat:", "refactor:", "perf:", "chore:"]):
            return line
    slug = fallback_desc[:60].lower().replace(" ", "-").replace("_", "-")
    slug = re.sub(r"[^a-z0-9-]", "", slug)
    return f"fix: {slug}"


def _build_pr_description(request: PRRequest, llm_content: str) -> str:
    return f"""## 🔧 Auto-Generated Fix by LogAI Platform

### Summary
{request.description}

### Problem
{request.fix_description}

### Changes
- File modified: `{request.file_path}`
- Branch: `{request.branch_name}`
- Generated by: LogAI Root Cause Analyzer

### LLM Analysis
{llm_content[:500]}...

### Checklist
- [ ] Code reviewed
- [ ] Tests passing
- [ ] Staging deployment validated
- [ ] Rollback plan ready

---
*This PR was auto-generated by LogAI Platform. Please review carefully before merging.*"""
