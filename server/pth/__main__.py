import uvicorn

from pth.api import create_app

app = create_app()

if __name__ == "__main__":
    uvicorn.run("pth.__main__:app", host="127.0.0.1", port=8000, reload=False)
