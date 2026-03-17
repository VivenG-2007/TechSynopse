import httpx
import json
import asyncio

async def debug_pr():
    url = "http://localhost:8000/pr/generate"
    payload = {
        "repo_url": "https://github.com/test/repo",
        "branch_name": "fix/test",
        "title": "Test PR",
        "description": "Test PR description",
        "file_path": "test.py",
        "original_code": "def hello():\n    print('hello')\n",
        "fix_description": "Add world to print",
        "language": "python"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, timeout=30.0)
            print(f"Status: {resp.status_code}")
            data = resp.json()
            print("Patch length:", len(data.get('patch', '')))
            print("Patch content preview:")
            print(data.get('patch', '')[:200])
            print("Status:", data.get('status'))
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_pr())
