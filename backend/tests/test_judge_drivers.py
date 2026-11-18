"""The hidden drivers, really executed: every supported type must round-trip in every language, and the reference solutions must pass
through them. Runs in the local subprocess sandbox; a language whose compiler is missing (or that the OS refuses to start) is skipped.

By default each language runs a representative set of problems; RUN_FULL_DRIVER_MATRIX=1 runs all 12 in all 5 languages (about 2 minutes).
The proof against the real online compiler is scripts/check_reference_solutions.py.
"""
import os
import re

import pytest

from app.data.coding_problems import EXPANDED_CODING_PROBLEMS
from app.services import function_judge as fj
from app.services import judge_drivers as drivers
from app.services.sandbox_errors import SandboxUnavailable
from tests.reference_solutions import REFERENCE

BY_SLUG = {p["slug"]: p for p in EXPANDED_CODING_PROBLEMS}
LANGS = ("python", "javascript", "java", "cpp", "c")
FULL = os.environ.get("RUN_FULL_DRIVER_MATRIX") == "1"
REPRESENTATIVE = ["sum-two-numbers", "count-vowels", "merge-sorted-arrays", "pair-sum-exists"]


async def run_local(problem, language, code, cases):
    try:
        outcome = await fj.run_function_cases(problem, language, code, cases)
    except SandboxUnavailable as exc:
        pytest.skip(f"{language} cannot run here: {exc}")
    if outcome.verdict == "Compiler Not Installed":
        pytest.skip(f"no {language} compiler installed")
    return outcome


# --------------------------------------------------------------------------- the program text
@pytest.mark.parametrize("language", LANGS)
@pytest.mark.parametrize("slug", sorted(BY_SLUG))
def test_program_layout_keeps_the_students_code_recognisable(slug, language):
    p = BY_SLUG[slug]
    sig = fj.signature_of(p)
    code = REFERENCE[slug].get(language, "") if language != "c" or sig.c_available else None
    assert code is not None
    program = drivers.build_program(language, sig, code)
    lines = program.source.split("\n")
    first_student_line = code.replace("\r\n", "\n").split("\n")[0]
    assert program.prefix_lines == drivers.prefix_line_count(language)
    assert lines[program.prefix_lines] == first_student_line  # the student's code starts right after the include lines
    assert program.student_lines == code.count("\n") + (0 if code.endswith("\n") else 1)
    assert "@@" in program.source and "nonce" not in program.source.lower().replace("the nonce", "")  # the nonce only ever travels in stdin
    assert program.source.startswith(drivers._PREFIX[language])


def test_the_driver_is_independent_of_the_solution():
    """The generated driver is the same for the starter code and for a finished solution, so it cannot carry any solution of its own.
    It also knows nothing about the test data: only the signature (name and types) shapes it."""
    for p in EXPANDED_CODING_PROBLEMS:
        sig = fj.signature_of(p)
        for language in LANGS:
            if language == "c" and not sig.c_available:
                continue
            stub, solution = fj.starter_code(p)[language], REFERENCE[p["slug"]][language]
            longest = max(stub.count("\n"), solution.count("\n"))  # the student's line count is the only input the driver may use
            stub, solution = stub.rstrip("\n") + "\n" * (longest - stub.rstrip("\n").count("\n")), solution.rstrip("\n") + "\n" * (longest - solution.rstrip("\n").count("\n"))
            a, b = drivers.build_program(language, sig, stub), drivers.build_program(language, sig, solution)
            assert a.student_lines == b.student_lines
            tail_a = a.source[len(drivers._PREFIX[language]):][len(stub):]
            tail_b = b.source[len(drivers._PREFIX[language]):][len(solution):]
            assert tail_a == tail_b, (p["slug"], language)
            for t in (str(p["test_cases"][-1]["expected"]), fj.compact_json(p["test_cases"][-1]["args"])):
                if len(t) > 10:
                    assert t not in a.source


def test_c_driver_refuses_types_it_cannot_carry():
    sig = drivers.Signature("f", (("m", "int[][]"),), "int")
    with pytest.raises(ValueError, match="C is only offered"):
        drivers.build_program("c", sig, "int f() { return 0; }")
    with pytest.raises(ValueError, match="Unsupported language"):
        drivers.build_program("ruby", sig, "x")


# --------------------------------------------------------------------------- reference solutions through the real drivers
def reference_params():
    slugs = sorted(BY_SLUG) if FULL else REPRESENTATIVE
    return [(slug, lang) for slug in slugs for lang in LANGS]


@pytest.mark.parametrize(("slug", "language"), reference_params())
async def test_reference_solution_is_accepted_through_the_driver(slug, language):
    p = BY_SLUG[slug]
    code = REFERENCE[slug][language]
    cases = [fj.CaseInput(args=c["args"], expected=c["expected"], has_expected=True, shown=not c["hidden"]) for c in p["test_cases"]]
    outcome = await run_local(p, language, code, cases)
    assert outcome.compile_output == "" or outcome.verdict != "Compile Error", outcome.compile_output
    assert outcome.verdict == "Accepted", [(c.index, c.status, c.error) for c in outcome.cases if c.status != "Passed"][:3]
    assert len(outcome.cases) == len(cases)


# --------------------------------------------------------------------------- type sweep: every supported type, every language
VALUES = {
    "int": [0, -1, 7, 2147483647, -2147483648],
    "long": [0, 5, -5, 9007199254740991, -9007199254740991, 123456789012],
    "double": [0.0, 1.5, -2.25, 3.14159, 1e-7, 1e10],
    "bool": [True, False],
    "string": ["", "hello", 'say "hi"', "back\\slash", "tab\there\nnewline", " spaces ", "{}[]:,"],
    "string[]": [[], ["a"], ["x y", 'q"uote', ""]],
    "int[]": [[], [1], [3, -4, 5, 2147483647]],
    "long[]": [[], [9007199254740991, -5, 0]],
    "int[][]": [[], [[]], [[1, 2], [3]], [[], [7, -8]]],
}

IDENTITY = {
    "python": lambda t: "class Solution:\n    def echo(self, x):\n        return x\n",
    "javascript": lambda t: "function echo(x) { return x; }\n",
    "java": lambda t: f"class Solution {{\n    public {drivers.java_type(t)} echo({drivers.java_type(t)} x) {{ return x; }}\n}}\n",
    "cpp": lambda t: f"class Solution {{\npublic:\n    {drivers.cpp_type(t).replace('std::', '')} echo({drivers.cpp_type(t).replace('std::', '')} x) {{ return x; }}\n}};\n",
}
C_IDENTITY = {
    "int": "int echo(int x) { return x; }\n",
    "long": "long long echo(long long x) { return x; }\n",
    "double": "double echo(double x) { return x; }\n",
    "bool": "bool echo(bool x) { return x; }\n",
    "string": "char* echo(const char* x) { char* r = (char*)malloc(strlen(x) + 1); strcpy(r, x); return r; }\n",
    "int[]": "int* echo(int* x, int xSize, int* returnSize) { int* r = (int*)malloc((xSize + 1) * sizeof(int)); memcpy(r, x, xSize * sizeof(int)); *returnSize = xSize; return r; }\n",
}


def sweep_params():
    out = []
    for language in LANGS:
        for t in drivers.SUPPORTED_TYPES:
            if language == "c" and t not in drivers.C_TYPES:
                continue
            out.append((language, t))
    return out


@pytest.mark.parametrize(("language", "t"), sweep_params())
async def test_every_supported_type_round_trips_in_every_driver(language, t):
    problem = {"function_name": "echo", "params": [{"name": "x", "type": t}], "return_type": t, "time_limit_ms": 2000}
    code = C_IDENTITY[t] if language == "c" else IDENTITY[language](t)
    cases = [fj.CaseInput(args=[v], expected=v, has_expected=True) for v in VALUES[t]]
    for case in cases:
        fj.check_value(case.args[0], t)
    outcome = await run_local(problem, language, code, cases)
    assert outcome.verdict == "Accepted", (language, t, outcome.compile_output[:300], [(c.index, c.status, c.error, c.your_output) for c in outcome.cases if c.status != "Passed"][:3])


async def test_two_parameters_of_different_types_arrive_in_order():
    problem = {"function_name": "mix", "params": [{"name": "s", "type": "string"}, {"name": "n", "type": "int"}, {"name": "xs", "type": "int[]"}], "return_type": "string",
               "time_limit_ms": 2000}
    code = {
        "python": 'class Solution:\n    def mix(self, s, n, xs):\n        return s + ":" + str(n) + ":" + ",".join(map(str, xs))\n',
        "javascript": 'function mix(s, n, xs) { return s + ":" + n + ":" + xs.join(","); }\n',
    }
    cases = [fj.CaseInput(args=["ab", 3, [4, 5]], expected="ab:3:4,5", has_expected=True), fj.CaseInput(args=["", -1, []], expected=":-1:", has_expected=True)]
    for language, source in code.items():
        outcome = await run_local(problem, language, source, cases)
        assert outcome.verdict == "Accepted", language
