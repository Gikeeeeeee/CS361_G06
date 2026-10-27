import os
import sys
import shutil
import subprocess
import stat

def remove_readonly(func, path, exc_info):
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass

def clean_path(p: str) -> str:
    cleaned = p.replace('"', '').replace("'", '').strip()
    return os.path.abspath(cleaned)

def main():
    default_build = os.path.abspath(os.path.join(os.path.dirname(__file__), "build"))
    default_src = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "backend"))

    source_dir = clean_path(sys.argv[1]) if len(sys.argv) > 1 else default_src
    build_dir = clean_path(sys.argv[2]) if len(sys.argv) > 2 else default_build

    print(f"Building Lambda package...")
    print(f"Source dir: {source_dir}")
    print(f"Build dir:  {build_dir}")

    # Check if build directory already exists and has dependencies
    has_existing_packages = os.path.exists(build_dir) and os.path.exists(os.path.join(build_dir, "boto3"))

    # Normalize paths for Docker volume mounts
    src_mount = source_dir.replace("\\", "/")
    out_mount = build_dir.replace("\\", "/")

    user_args = []
    if hasattr(os, "getuid") and hasattr(os, "getgid") and os.name != "nt":
        user_args = ["--user", f"{os.getuid()}:{os.getgid()}"]

    docker_cmd = [
        "docker", "run", "--rm",
        "--platform", "linux/amd64",
        *user_args,
        "--entrypoint", "/bin/sh",
        "-e", "HOME=/tmp",
        "-v", f"{src_mount}:/src:ro",
        "-v", f"{out_mount}:/out",
        "public.ecr.aws/lambda/python:3.12",
        "-c", "python -m pip install -r /src/requirements.txt -t /out"
    ]

    docker_success = False
    try:
        if not has_existing_packages:
            if os.path.exists(build_dir):
                shutil.rmtree(build_dir, onerror=remove_readonly)
            os.makedirs(build_dir, exist_ok=True)

        print("Running Docker container to install dependencies...")
        res = subprocess.run(docker_cmd)
        if res.returncode == 0:
            docker_success = True
        else:
            print(f"Docker command exited with code {res.returncode}")
    except Exception as e:
        print(f"Docker execution failed: {e}")

    if not docker_success:
        if has_existing_packages:
            print("Notice: Docker install failed/skipped, reusing existing installed packages in build directory.")
        else:
            print("Error: Docker build failed and no existing build directory found.")
            sys.exit(1)

    # 3. Copy source files into build directory
    print("Copying backend source files...")
    ignore_list = {"env", "venv", ".venv", "__pycache__", ".pytest_cache", "tests"}
    for item in os.listdir(source_dir):
        if item in ignore_list:
            continue
        src_path = os.path.join(source_dir, item)
        dst_path = os.path.join(build_dir, item)
        if os.path.isdir(src_path):
            shutil.copytree(
                src_path,
                dst_path,
                dirs_exist_ok=True,
                ignore=shutil.ignore_patterns("*.pyc", "__pycache__", ".pytest_cache", "env", "venv", ".venv")
            )
        else:
            shutil.copy2(src_path, dst_path)

    # 4. Clean up any excluded items in build directory
    for item in ignore_list:
        p = os.path.join(build_dir, item)
        if os.path.exists(p):
            if os.path.isdir(p):
                shutil.rmtree(p, onerror=remove_readonly)
            else:
                os.remove(p)

    print("Lambda build completed successfully.")

if __name__ == "__main__":
    main()
