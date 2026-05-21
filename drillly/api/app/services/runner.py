import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from app.config import settings

MAX_OUTPUT = 64 * 1024


def _find_compiler(name: str) -> str | None:
    if settings.mingw_bin:
        candidate = Path(settings.mingw_bin) / (name + ".exe")
        if candidate.exists():
            return str(candidate)
    return shutil.which(name)


def execute_code(language: str, code: str, stdin: str = "") -> dict:
    lang = language.lower()
    timeout = settings.runner_timeout_sec

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        if lang == "python":
            src = work / "main.py"
            src.write_text(code, encoding="utf-8")
            cmd = ["python", str(src)]
        elif lang == "java":
            src = work / "Main.java"
            src.write_text(code, encoding="utf-8")
            compile = subprocess.run(
                ["javac", str(src)],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=work,
            )
            if compile.returncode != 0:
                return {
                    "stdout": "",
                    "stderr": compile.stderr or compile.stdout,
                    "exit_code": compile.returncode,
                    "timed_out": False,
                }
            cmd = ["java", "-cp", str(work), "Main"]
        elif lang in ("c", "cpp"):
            gcc = _find_compiler("gcc") if lang == "c" else _find_compiler("g++")
            if not gcc:
                hint = (
                    "未找到 gcc/g++。请安装 MSYS2/MinGW 并设置环境变量 MINGW_BIN，"
                    "例如 C:\\msys64\\ucrt64\\bin"
                )
                return {"stdout": "", "stderr": hint, "exit_code": -1, "timed_out": False}
            exe = work / ("main.exe" if os.name == "nt" else "main")
            src = work / ("main.c" if lang == "c" else "main.cpp")
            src.write_text(code, encoding="utf-8")
            compile = subprocess.run(
                [gcc, str(src), "-o", str(exe)],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=work,
            )
            if compile.returncode != 0:
                return {
                    "stdout": "",
                    "stderr": compile.stderr or compile.stdout,
                    "exit_code": compile.returncode,
                    "timed_out": False,
                }
            cmd = [str(exe)]
        else:
            return {
                "stdout": "",
                "stderr": f"不支持的语言: {language}",
                "exit_code": -1,
                "timed_out": False,
            }

        try:
            proc = subprocess.run(
                cmd,
                input=stdin,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=work,
            )
            out = (proc.stdout or "")[:MAX_OUTPUT]
            err = (proc.stderr or "")[:MAX_OUTPUT]
            return {
                "stdout": out,
                "stderr": err,
                "exit_code": proc.returncode,
                "timed_out": False,
            }
        except subprocess.TimeoutExpired:
            return {
                "stdout": "",
                "stderr": f"运行超时（>{timeout}s）",
                "exit_code": -1,
                "timed_out": True,
            }
