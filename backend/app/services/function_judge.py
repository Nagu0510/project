"""Function-style judge: the student writes one function, a hidden driver calls it for every test case.

  * types, value checks, display text and the "name = value" custom-input format
  * starter code GENERATED from function_name / params / return_type (never hand-written, never a hint)
  * result comparison (parsed JSON values, double tolerance 1e-6, optional order-insensitive arrays)
  * running a batch of cases in ONE provider call and turning the driver's lines into verdicts

Nothing about a hidden case (input, expected output, the student program's output or error text for it) is ever put into a
result that leaves this module: hidden cases come back as a number and a pass/fail flag only.
"""
import json
import math
import re
import secrets
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from app.services import judge_drivers as drivers
from app.services.judge_drivers import SUPPORTED_TYPES, Signature

LANGUAGES = ("python", "javascript", "java", "cpp", "c")
ALIASES = {"py": "python", "js": "javascript", "node": "javascript", "c++": "cpp"}
LONG_MAX = 2 ** 53 - 1          # beyond this a JavaScript number is no longer exact, so no language is asked to handle it
INT_MIN, INT_MAX = -(2 ** 31), 2 ** 31 - 1
MAX_ARRAY = 200_000
STDOUT_SHOWN_BYTES = 4096
ERROR_SHOWN_BYTES = 4096
DISPLAY_LIMIT = 2000
MAX_CUSTOM_CASES = 5
MAX_CASE_TEXT = 20_000
DOUBLE_TOLERANCE = 1e-6
PROVIDER_CPU_SECONDS = 10       # one execution runs every case: the whole batch has this much CPU time
PROVIDER_WALL_SECONDS = 15

PASSED, WRONG, RUNTIME, TLE, OLE, NOT_RUN, FINISHED = "Passed", "Wrong Answer", "Runtime Error", "Time Limit Exceeded", "Output Limit Exceeded", "Not run", "Finished"
FAILING = (WRONG, RUNTIME, TLE, OLE)


def normalize_language(language: str) -> str:
    key = ALIASES.get((language or "").lower().strip(), (language or "").lower().strip())
    if key not in LANGUAGES:
        raise ValueError(f"Unsupported language '{language}'. Choose one of: python, javascript, java, cpp, c.")
    return key


# ---------------------------------------------------------------------------
# Signature, values, display
# ---------------------------------------------------------------------------
def signature_of(problem: dict) -> Signature:
    return Signature(problem["function_name"], tuple((p["name"], p["type"]) for p in problem["params"]), problem["return_type"])


def check_value(value: Any, t: str) -> None:
    """Raise ValueError when `value` is not a legal JSON value of type `t`."""
    if t not in SUPPORTED_TYPES:
        raise ValueError(f"unsupported type {t}")
    if t == "int":
        if isinstance(value, bool) or not isinstance(value, int) or not INT_MIN <= value <= INT_MAX:
            raise ValueError("expected a whole number between -2147483648 and 2147483647")
    elif t == "long":
        if isinstance(value, bool) or not isinstance(value, int) or abs(value) > LONG_MAX:
            raise ValueError("expected a whole number between -9007199254740991 and 9007199254740991")
    elif t == "double":
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError("expected a number")
    elif t == "bool":
        if not isinstance(value, bool):
            raise ValueError("expected true or false")
    elif t == "string":
        if not isinstance(value, str):
            raise ValueError('expected text in double quotes, like "hello"')
    else:
        if not isinstance(value, list):
            raise ValueError(f"expected a list like [1,2,3] ({t})")
        if len(value) > MAX_ARRAY:
            raise ValueError(f"the list is longer than {MAX_ARRAY} items")
        inner = t[:-2]
        for i, item in enumerate(value):
            try:
                check_value(item, inner)
            except ValueError as exc:
                raise ValueError(f"item {i + 1}: {exc}") from None


def check_args(problem: dict, args: list) -> None:
    params = problem["params"]
    if len(args) != len(params):
        raise ValueError(f"expected {len(params)} argument(s), got {len(args)}")
    for value, p in zip(args, params):
        try:
            check_value(value, p["type"])
        except ValueError as exc:
            raise ValueError(f"{p['name']}: {exc}") from None


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def truncate_display(text: str, limit: int = DISPLAY_LIMIT) -> str:
    return text if len(text) <= limit else text[:limit] + f"... ({len(text) - limit} more characters)"


def display_value(value: Any) -> str:
    return truncate_display(compact_json(value))


def display_args(names: List[str], args: list) -> str:
    """The text of one case in the custom-input format: one `name = value` line per parameter."""
    return "\n".join(f"{n} = {truncate_display(compact_json(v))}" for n, v in zip(names, args))


class CaseInputError(ValueError):
    """A custom test case that cannot be read. `errors` is a list of {case, field, message} for the editor to show."""

    def __init__(self, errors: List[dict]):
        super().__init__(errors[0]["message"] if errors else "invalid test case")
        self.errors = errors


def parse_case_text(problem: dict, text: str, case_number: int = 1) -> list:
    """Read "nums = [2,7,11,15]\\ntarget = 9" into the argument list, in the declared parameter order."""
    params = problem["params"]
    names = [p["name"] for p in params]
    sample = {"string": '"text"'}
    example = "\n".join(f"{p['name']} = {sample.get(p['type'], '[1,2,3]' if p['type'].endswith('[]') else '5')}" for p in params)
    errors: List[dict] = []
    values: Dict[str, Any] = {}

    def err(field_name: Optional[str], message: str) -> None:
        errors.append({"case": case_number, "field": field_name, "message": message})

    if len(text) > MAX_CASE_TEXT:
        raise CaseInputError([{"case": case_number, "field": None, "message": f"The test case is longer than {MAX_CASE_TEXT} characters."}])
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^([A-Za-z_]\w*)\s*=\s*(.*)$", line)
        if not m:
            err(None, f"Write each input on its own line as name = value, like:\n{example}")
            continue
        name, raw_value = m.group(1), m.group(2).strip()
        if name not in names:
            err(name, f"'{name}' is not an input of this problem. The inputs are: {', '.join(names)}.")
            continue
        if name in values:
            err(name, f"'{name}' appears twice.")
            continue
        t = next(p["type"] for p in params if p["name"] == name)
        try:
            parsed = json.loads(raw_value)
        except ValueError:
            if t == "string":
                err(name, f'{name}: text needs double quotes, like {name} = "hello".')
            elif t.endswith("[]"):
                err(name, f"{name}: write a list like [1,2,3] (numbers separated by commas, no trailing comma).")
            else:
                err(name, f"{name}: could not read '{raw_value[:40]}' as a {t} value.")
            continue
        try:
            check_value(parsed, t)
        except ValueError as exc:
            err(name, f"{name}: {exc}.")
            continue
        values[name] = parsed
    for n in names:
        if n not in values and not any(e["field"] == n for e in errors):
            err(n, f"{n} is missing. Add a line like: {n} = ...")
    if errors:
        raise CaseInputError(errors)
    return [values[n] for n in names]


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------
def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _canonical(value: Any) -> str:
    if isinstance(value, float):
        return repr(round(value, 6))
    if isinstance(value, list):
        return "[" + ",".join(_canonical(v) for v in value) + "]"
    return json.dumps(value, ensure_ascii=False)


def values_equal(actual: Any, expected: Any, t: str, order_insensitive: bool = False) -> bool:
    if t in ("int", "long"):
        return _is_number(actual) and actual == expected
    if t == "double":
        return _is_number(actual) and abs(actual - expected) <= DOUBLE_TOLERANCE * max(1.0, abs(expected))
    if t == "bool":
        return isinstance(actual, bool) and actual == expected
    if t == "string":
        return isinstance(actual, str) and actual == expected
    if not isinstance(actual, list) or len(actual) != len(expected):
        return False
    inner = t[:-2]
    if order_insensitive:
        actual = sorted(actual, key=_canonical)
        expected = sorted(expected, key=_canonical)
    return all(values_equal(a, e, inner, False) for a, e in zip(actual, expected))


# ---------------------------------------------------------------------------
# Starter code (generated from the signature)
# ---------------------------------------------------------------------------
_PY_TYPES = {"int": "int", "long": "int", "double": "float", "bool": "bool", "string": "str", "int[]": "List[int]", "long[]": "List[int]",
             "string[]": "List[str]", "int[][]": "List[List[int]]"}
_JS_TYPES = {"int": "number", "long": "number", "double": "number", "bool": "boolean", "string": "string", "int[]": "number[]", "long[]": "number[]",
             "string[]": "string[]", "int[][]": "number[][]"}
_C_TYPES = {"int": "int", "long": "long long", "double": "double", "bool": "bool", "string": "const char*"}


def starter_code(problem: dict) -> Dict[str, str]:
    """One stub per language: the signature and an empty body. No solution, no hint. C is left out when the types do not fit."""
    sig = signature_of(problem)
    params = sig.params
    py_args = ", ".join(f"{n}: {_PY_TYPES[t]}" for n, t in params)
    python = (f"from typing import List\n\n\nclass Solution:\n    def {sig.snake_name}(self{', ' if params else ''}{py_args}) -> {_PY_TYPES[sig.returns]}:\n        pass\n")
    doc = "".join(f" * @param {{{_JS_TYPES[t]}}} {n}\n" for n, t in params) + f" * @return {{{_JS_TYPES[sig.returns]}}}\n"
    javascript = f"/**\n{doc} */\nfunction {sig.name}({', '.join(n for n, _ in params)}) {{\n\n}}\n"
    java = (f"import java.util.*;\n\nclass Solution {{\n    public {drivers.java_type(sig.returns)} {sig.name}"
            f"({', '.join(f'{drivers.java_type(t)} {n}' for n, t in params)}) {{\n        \n    }}\n}}\n")

    def cpp_param(n: str, t: str) -> str:
        c = drivers.cpp_type(t).replace("std::", "")
        return f"{c}& {n}" if t.endswith("]") else f"{c} {n}"

    cpp = (f"#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {{\npublic:\n    {drivers.cpp_type(sig.returns).replace('std::', '')} {sig.name}"
           f"({', '.join(cpp_param(n, t) for n, t in params)}) {{\n        \n    }}\n}};\n")
    out = {"python": python, "javascript": javascript, "java": java, "cpp": cpp}
    if sig.c_available:
        c_params = []
        for n, t in params:
            if t == "int[]":
                c_params += [f"int* {n}", f"int {n}Size"]
            else:
                c_params.append(f"{_C_TYPES[t]} {n}")
        c_ret = "int*" if sig.returns == "int[]" else "char*" if sig.returns == "string" else _C_TYPES[sig.returns]
        if sig.returns == "int[]":
            c_params.append("int* returnSize")
        note = "/* Allocate the result with malloc and set *returnSize to its length. */\n" if sig.returns == "int[]" else "/* Return a string allocated with malloc. */\n" if sig.returns == "string" else ""
        out["c"] = ("#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>\n\n" + note
                    + f"{c_ret} {sig.snake_name}({', '.join(c_params)}) {{\n    \n}}\n")
    return out


# ---------------------------------------------------------------------------
# Public view of a problem and validation of the stored data
# ---------------------------------------------------------------------------
def public_problem(doc: dict) -> dict:
    """Everything a student may see. Built field by field from an allow-list, so a new stored field is never exposed by accident:
    no hidden case, no hints (they come one at a time from /hints), no reference solution."""
    sig = signature_of(doc)
    cases = doc.get("test_cases") or []
    examples = []
    for ex in doc.get("examples") or []:
        examples.append({"input": ex["input"], "output": ex["output"], "explanation": ex.get("explanation") or ""})
    shown = [c for c in cases if not c.get("hidden")]
    return {
        "id": doc["id"], "slug": doc["slug"], "title": doc["title"], "difficulty": doc["difficulty"], "difficulty_rank": doc.get("difficulty_rank", 0),
        "category": doc.get("category") or doc.get("topic", ""), "topic": doc.get("topic", ""), "tags": doc.get("tags") or [],
        "description": doc["description"], "constraints": doc.get("constraints") or [],
        "function_name": sig.name, "params": [{"name": n, "type": t} for n, t in sig.params], "return_type": sig.returns,
        "examples": examples,
        "example_args": [c["args"] for c in shown],  # the editable inputs of "Case 1..n" (values of the shown examples)
        "starter_code": starter_code(doc),
        "c_available": sig.c_available, "c_disabled_reason": sig.c_disabled_reason,
        "time_limit_ms": int(doc.get("time_limit_ms") or 2000),
        "expected_complexity": doc.get("expected_complexity", ""),
        "hint_count": doc["hint_count"] if "hint_count" in doc else len(doc.get("hints") or []),
        "total_cases": doc["total_cases"] if "total_cases" in doc else len(cases), "shown_cases": len(shown),
    }


def validate_problem(p: dict) -> List[str]:
    """Problems with a stored problem document (empty list = fine). Run by the tests and by the seed."""
    issues: List[str] = []
    slug = p.get("slug", "?")
    try:
        sig = signature_of(p)
    except (KeyError, TypeError):
        return [f"{slug}: function_name / params / return_type missing"]
    if not re.fullmatch(r"[a-z][A-Za-z0-9]*", sig.name):
        issues.append(f"{slug}: function_name must be camelCase")
    for n, t in sig.params:
        if t not in SUPPORTED_TYPES:
            issues.append(f"{slug}: unsupported parameter type {t}")
        if not re.fullmatch(r"[a-z][A-Za-z0-9]*", n) or n in ("self", "returnSize"):
            issues.append(f"{slug}: bad parameter name {n}")
    if sig.returns not in SUPPORTED_TYPES:
        issues.append(f"{slug}: unsupported return type {sig.returns}")
    cases = p.get("test_cases") or []
    shown = [c for c in cases if not c.get("hidden")]
    hidden = [c for c in cases if c.get("hidden")]
    if not 2 <= len(shown) <= 3:
        issues.append(f"{slug}: needs 2 or 3 shown examples, has {len(shown)}")
    if len(p.get("examples") or []) != len(shown):
        issues.append(f"{slug}: examples and shown cases differ")
    if len(hidden) < 8:
        issues.append(f"{slug}: needs at least 8 hidden cases, has {len(hidden)}")
    if p.get("difficulty") in ("Medium", "Hard") and not any(c.get("large") for c in hidden):
        issues.append(f"{slug}: medium and hard problems need a large hidden case")
    for i, c in enumerate(cases, 1):
        try:
            check_args(p, c["args"])
            check_value(c["expected"], sig.returns)
        except (ValueError, KeyError) as exc:
            issues.append(f"{slug}: case {i}: {exc}")
    if len(p.get("hints") or []) != 3:
        issues.append(f"{slug}: needs exactly 3 hints")
    if not p.get("expected_complexity"):
        issues.append(f"{slug}: expected_complexity missing")
    if not 100 <= int(p.get("time_limit_ms") or 0) <= 5000:
        issues.append(f"{slug}: time_limit_ms must be between 100 and 5000")
    return issues


# ---------------------------------------------------------------------------
# Reading what the driver printed
# ---------------------------------------------------------------------------
@dataclass
class DriverOutput:
    rows: Dict[int, dict] = field(default_factory=dict)
    stdout_by_case: Dict[int, str] = field(default_factory=dict)
    trailing: str = ""


def parse_driver_stdout(stdout: str, nonce: str, count: int) -> DriverOutput:
    """Result lines start with @@<nonce>@@. Anything else is the student's own output. Lines with a wrong nonce are just output."""
    tag = f"@@{nonce}@@"
    out = DriverOutput()
    pending: List[str] = []
    for line in (stdout or "").replace("\r", "").split("\n"):
        if line.startswith(tag):
            try:
                row = json.loads(line[len(tag):])
            except ValueError:
                pending.append(line)
                continue
            i = row.get("i") if isinstance(row, dict) else None
            if not isinstance(i, int) or isinstance(i, bool) or not 0 <= i < count or i in out.rows or not isinstance(row.get("ok"), bool):
                pending.append(line)
                continue
            if pending and pending[-1] == "":  # the blank line the driver prints in front of every result line
                pending.pop()
            out.rows[i] = row
            out.stdout_by_case[i] = "\n".join(pending).rstrip("\n")
            pending = []
        else:
            pending.append(line)
    out.trailing = "\n".join(pending).strip("\n")
    return out


_LOCATION = re.compile(r'(?P<pre>File "[^"\n]*", line |[\w./\\:-]*?\b(?:script|main|Main|solution)\.(?:py|js|java|cpp|c):)(?P<line>\d+)(?P<col>:\d+)?')


def map_error_lines(text: str, prefix_lines: int, student_lines: int) -> Tuple[str, List[int]]:
    """Point the compiler's / interpreter's line numbers at the student's own code (the platform's include lines are subtracted).
    A location inside the driver is shown as 'driver code'. Returns the new text and the student lines mentioned."""
    lines: List[int] = []

    def fix(m: "re.Match[str]") -> str:
        n = int(m.group("line")) - prefix_lines
        if 1 <= n <= student_lines:
            lines.append(n)
            return m.group("pre") + str(n) + (m.group("col") or "")
        return "driver code (not your lines)"

    return _LOCATION.sub(fix, text or ""), sorted(set(lines))


def trim_bytes(text: str, limit: int) -> str:
    raw = (text or "").encode("utf-8", errors="replace")
    if len(raw) <= limit:
        return text or ""
    return raw[:limit].decode("utf-8", errors="ignore") + "\n[trimmed]"


# ---------------------------------------------------------------------------
# Running a batch
# ---------------------------------------------------------------------------
@dataclass
class CaseInput:
    args: list
    expected: Any = None
    has_expected: bool = False
    shown: bool = True          # False for hidden cases: nothing about them is ever reported
    text: str = ""              # display text of the input (shown / custom cases only)


@dataclass
class CaseResult:
    index: int                  # 1-based
    shown: bool
    has_expected: bool
    status: str
    your_output: Optional[str] = None
    error: Optional[str] = None
    error_line: Optional[int] = None
    ms: int = 0
    stdout: str = ""

    @property
    def passed(self) -> Optional[bool]:
        if self.status == PASSED:
            return True
        if self.status in FAILING:
            return False
        return None


@dataclass
class JudgeOutcome:
    verdict: str
    cases: List[CaseResult]
    compile_output: str = ""
    error_lines: List[int] = field(default_factory=list)
    runtime_ms: int = 0
    memory_kb: Optional[int] = None
    message: str = ""

    @property
    def first_failure(self) -> Optional[CaseResult]:
        return next((c for c in self.cases if c.status in FAILING), None)


def _compile_hints(text: str, sig: Signature, language: str, outside_driver: bool) -> str:
    hints = []
    if "missing return statement" in text:
        hints.append("A function with a return type must return a value on every path.")
    if not outside_driver or re.search(r"cannot find symbol|not declared|undeclared|no member named|has no attribute|is not defined", text):
        hints.append(f"Keep the class name Solution and the function name {sig.snake_name if language in ('python', 'c') else sig.name} exactly as in the starter code.")
    return ("\n\n" + " ".join(hints)) if hints else ""


async def run_function_cases(problem: dict, language: str, source_code: str, cases: List[CaseInput]) -> JudgeOutcome:
    """Run `cases` against the student's function in ONE provider call. Raises SandboxUnavailable / SandboxRateLimited when the
    provider fails (the caller decides how to report that: it is never a verdict about the student's code)."""
    from app.services.code_execution_service import execute_program

    language = normalize_language(language)
    sig = signature_of(problem)
    program = drivers.build_program(language, sig, source_code)
    nonce = secrets.token_hex(12)
    limit_ms = int(problem.get("time_limit_ms") or 2000)
    stdin = "\n".join([nonce, str(len(cases)), str(limit_ms), *[json.dumps(c.args, ensure_ascii=False, separators=(",", ":")) for c in cases]]) + "\n"
    res = await execute_program(language, program.source, stdin, cpu_seconds=PROVIDER_CPU_SECONDS, wall_seconds=PROVIDER_WALL_SECONDS)

    status = res["status"]
    parsed = parse_driver_stdout(res.get("stdout", ""), nonce, len(cases))
    stderr = res.get("stderr", "") or ""
    memory = res.get("memory_kb")

    # --- the code did not compile / parse -------------------------------------------------------------------------------------
    interpreter_syntax = status == "Runtime Error" and not parsed.rows and re.search(r"\b(SyntaxError|IndentationError|TabError)\b", stderr)
    if status == "Compile Error" or interpreter_syntax:
        raw = res.get("compile_output") or stderr or "Compilation failed."
        text, lines = map_error_lines(raw, program.prefix_lines, program.student_lines)
        text = trim_bytes(text, ERROR_SHOWN_BYTES) + _compile_hints(raw, sig, language, bool(lines))
        return JudgeOutcome("Compile Error", [], compile_output=text, error_lines=lines, message="Your code did not compile.")
    if status in ("Unsupported Language", "Compiler Not Installed", "Security Violation"):
        return JudgeOutcome(status, [], message=res.get("compile_output") or stderr or status)

    # --- what happened to the cases ----------------------------------------------------------------------------------------------
    last_row = parsed.rows[max(parsed.rows)] if parsed.rows else None
    stopped_on_tle = bool(last_row and last_row.get("kind") == "tle")
    first_missing = next((i for i in range(len(cases)) if i not in parsed.rows), None)
    crash: Optional[Tuple[str, str, Optional[int]]] = None
    if first_missing is not None and not stopped_on_tle:
        if status == "Time Limit Exceeded":
            crash = (TLE, "Your code did not finish within the time limit.", None)
        elif res.get("truncated"):
            crash = (OLE, "Your program printed too much output.", None)
        elif status == "Runtime Error":
            text, lines = map_error_lines(stderr, program.prefix_lines, program.student_lines)
            crash = (RUNTIME, trim_bytes(text, ERROR_SHOWN_BYTES) or "Your program crashed.", lines[0] if lines else None)
        else:
            crash = (RUNTIME, "Your program stopped before returning a result (did it call exit?).", None)

    results: List[CaseResult] = []
    budget = STDOUT_SHOWN_BYTES
    total_ms = 0
    for i, case in enumerate(cases):
        out = CaseResult(index=i + 1, shown=case.shown, has_expected=case.has_expected, status=NOT_RUN)
        row = parsed.rows.get(i)
        if row is not None:
            out.ms = int(row.get("ms") or 0)
            total_ms += out.ms
            if row["ok"]:
                actual = row.get("result")
                if case.has_expected:
                    ok = values_equal(actual, case.expected, sig.returns, bool(problem.get("order_insensitive")))
                    out.status = PASSED if ok else WRONG
                else:
                    out.status = FINISHED
                if case.shown:
                    out.your_output = display_value(actual)
            else:
                kind = row.get("kind")
                text = str(row.get("error") or "")
                if kind == "tle":
                    out.status = TLE
                elif kind == "nothing":
                    out.status, out.error = WRONG, "Your function returned nothing"
                else:
                    out.status = RUNTIME
                    if case.shown:
                        out.error = trim_bytes(text, ERROR_SHOWN_BYTES)
                        line = row.get("line")
                        out.error_line = line if isinstance(line, int) and 1 <= line <= program.student_lines else None
                    else:
                        out.error = text.split(":")[0][:60]  # a hidden case: the kind of error only, never its message
                if kind == "nothing" and not case.shown:
                    out.error = "Your function returned nothing"
        elif crash is not None and i == first_missing:
            out.status = crash[0]
            if case.shown:
                out.error, out.error_line = crash[1], crash[2]
        if case.shown:
            raw_out = parsed.stdout_by_case.get(i, "")
            if row is None and i == first_missing and parsed.trailing:
                raw_out = (raw_out + "\n" + parsed.trailing).strip("\n") if raw_out else parsed.trailing
            shown_out = trim_bytes(raw_out, max(0, min(budget, STDOUT_SHOWN_BYTES)))
            budget -= len(shown_out.encode("utf-8"))
            out.stdout = shown_out
        results.append(out)

    outcome = JudgeOutcome("Accepted", results, runtime_ms=total_ms or int(res.get("runtime_ms") or 0), memory_kb=memory if isinstance(memory, int) else None)
    failure = outcome.first_failure
    if failure is not None:
        outcome.verdict = failure.status
        outcome.message = f"Test case {failure.index} of {len(results)} failed ({failure.status})."
    return outcome
