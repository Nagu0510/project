"""Hidden drivers that wrap a student's function so a whole batch of test cases runs in ONE program execution.

Protocol (stdin): line 1 = random nonce, line 2 = number of cases N, line 3 = per-case time limit in ms, then N lines, each a
JSON array with the arguments of one case. After every case the driver prints, and flushes, one line
    @@<nonce>@@{"i": <0-based case>, "ok": true, "result": <json>, "ms": <int>}
    @@<nonce>@@{"i": ..., "ok": false, "kind": "runtime" | "nothing" | "tle", "error": "...", "line": <student line>, "ms": ...}
Everything the student's code prints itself is NOT part of the verdict. A student cannot forge a result line without the nonce,
which only travels in stdin. The driver is appended after the student's code (a few include lines may be put in front), so the
student's own line numbers stay recognisable: build_program() reports how many prefix lines were added.

No third-party library is used: Python's json module, Node's JSON, and small hand-written JSON readers for Java, C++ and C.
"""
from dataclasses import dataclass
from typing import List, Optional, Tuple

SCALARS = ("int", "long", "double", "bool", "string")
SUPPORTED_TYPES = SCALARS + ("int[]", "long[]", "string[]", "int[][]")
C_TYPES = ("int", "long", "double", "bool", "string", "int[]")  # what the C driver can pass and return

Param = Tuple[str, str]  # (name, type)


@dataclass(frozen=True)
class Signature:
    name: str                 # camelCase function name
    params: Tuple[Param, ...]
    returns: str

    @property
    def snake_name(self) -> str:
        out = []
        for i, ch in enumerate(self.name):
            if ch.isupper() and i:
                out.append("_")
            out.append(ch.lower())
        return "".join(out)

    @property
    def c_available(self) -> bool:
        return all(t in C_TYPES for _, t in self.params) and self.returns in C_TYPES

    @property
    def c_disabled_reason(self) -> str:
        return "" if self.c_available else "C is only offered for problems that use numbers, booleans, text and integer arrays."


@dataclass(frozen=True)
class Program:
    source: str
    prefix_lines: int         # lines the platform put in front of the student's code
    student_lines: int


# ---------------------------------------------------------------------------
# Python
# ---------------------------------------------------------------------------
_PY = r'''

# ---- platform driver: it calls your function and reports the results; it is not part of your solution ----
def __sk_main():
    import sys, json, time, traceback
    out = sys.stdout
    rows = sys.stdin.read().split("\n")
    tag = "@@" + rows[0].strip() + "@@"
    count, limit = int(rows[1]), int(rows[2])

    def emit(row):
        out.write("\n" + tag + json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
        out.flush()

    try:
        fn = getattr(Solution(), "__NAME__")
    except BaseException as exc:
        emit({"i": 0, "ok": False, "kind": "runtime", "error": "Could not find Solution.__NAME__ (" + type(exc).__name__ + ")", "ms": 0})
        return
    for i in range(count):
        args = json.loads(rows[3 + i])
        began = time.perf_counter()
        try:
            value = fn(*args)
            ms = int((time.perf_counter() - began) * 1000)
            row = {"i": i, "ok": True, "result": value, "ms": ms}
            if value is None:
                row = {"i": i, "ok": False, "kind": "nothing", "error": "Your function returned nothing", "ms": ms}
            else:
                json.dumps(row, ensure_ascii=False)
        except BaseException as exc:
            ms = int((time.perf_counter() - began) * 1000)
            line = None
            for frame in reversed(traceback.extract_tb(exc.__traceback__)):
                if frame.filename == __sk_main.__code__.co_filename and frame.lineno <= __STUDENT_LINES__:
                    line = frame.lineno
                    break
            row = {"i": i, "ok": False, "kind": "runtime", "error": (type(exc).__name__ + ": " + str(exc))[:400], "line": line, "ms": ms}
        if ms > limit:
            emit({"i": i, "ok": False, "kind": "tle", "ms": ms})
            return
        emit(row)


__sk_main()
'''


# ---------------------------------------------------------------------------
# JavaScript
# ---------------------------------------------------------------------------
_JS = r'''

// ---- platform driver: it calls your function and reports the results; it is not part of your solution ----
(function skMain() {
  const fs = require('fs');
  const rows = fs.readFileSync(0, 'utf8').split('\n');
  const tag = '@@' + rows[0].trim() + '@@';
  const count = parseInt(rows[1], 10);
  const limit = parseInt(rows[2], 10);
  const emit = (row) => fs.writeSync(1, '\n' + tag + JSON.stringify(row) + '\n');
  if (typeof __NAME__ !== 'function') {
    emit({ i: 0, ok: false, kind: 'runtime', error: 'Function __NAME__ is not defined', ms: 0 });
    return;
  }
  for (let i = 0; i < count; i++) {
    const args = JSON.parse(rows[3 + i]);
    const began = process.hrtime.bigint();
    let row;
    let ms;
    try {
      const value = __NAME__(...args);
      ms = Number((process.hrtime.bigint() - began) / 1000000n);
      if (value === undefined || value === null) {
        row = { i, ok: false, kind: 'nothing', error: 'Your function returned nothing', ms };
      } else {
        row = { i, ok: true, result: value, ms };
        JSON.stringify(row);
      }
    } catch (exc) {
      ms = Number((process.hrtime.bigint() - began) / 1000000n);
      const text = exc && exc.name ? exc.name + ': ' + exc.message : String(exc);
      let line = null;
      const found = String(exc && exc.stack).match(/\.js:(\d+):\d+/);
      if (found && Number(found[1]) <= __STUDENT_LINES__) line = Number(found[1]);
      row = { i, ok: false, kind: 'runtime', error: text.slice(0, 400), line, ms };
    }
    if (ms > limit) {
      emit({ i, ok: false, kind: 'tle', ms });
      return;
    }
    emit(row);
  }
})();
'''


# ---------------------------------------------------------------------------
# Java
# ---------------------------------------------------------------------------
_JAVA = r'''

// ---- platform driver: it calls your method and reports the results; it is not part of your solution ----
public class Main {
    static String text;
    static int at;
    static String tag;

    static void ws() { while (at < text.length() && Character.isWhitespace(text.charAt(at))) at++; }

    static Object read() {
        ws();
        char c = text.charAt(at);
        if (c == '[') {
            at++;
            java.util.ArrayList<Object> list = new java.util.ArrayList<>();
            ws();
            if (text.charAt(at) == ']') { at++; return list; }
            while (true) {
                list.add(read());
                ws();
                char d = text.charAt(at++);
                if (d == ']') return list;
            }
        }
        if (c == '"') {
            at++;
            StringBuilder sb = new StringBuilder();
            while (true) {
                char d = text.charAt(at++);
                if (d == '"') return sb.toString();
                if (d == '\\') {
                    char e = text.charAt(at++);
                    switch (e) {
                        case 'n': sb.append('\n'); break;
                        case 't': sb.append('\t'); break;
                        case 'r': sb.append('\r'); break;
                        case 'b': sb.append('\b'); break;
                        case 'f': sb.append('\f'); break;
                        case 'u': sb.append((char) Integer.parseInt(text.substring(at, at + 4), 16)); at += 4; break;
                        default: sb.append(e);
                    }
                } else sb.append(d);
            }
        }
        if (text.startsWith("true", at)) { at += 4; return Boolean.TRUE; }
        if (text.startsWith("false", at)) { at += 5; return Boolean.FALSE; }
        if (text.startsWith("null", at)) { at += 4; return null; }
        int start = at;
        while (at < text.length() && "+-0123456789.eE".indexOf(text.charAt(at)) >= 0) at++;
        String num = text.substring(start, at);
        if (num.indexOf('.') >= 0 || num.indexOf('e') >= 0 || num.indexOf('E') >= 0) return Double.valueOf(num);
        return Long.valueOf(num);
    }

    static int asInt(Object o) { return (int) ((Number) o).longValue(); }
    static long asLong(Object o) { return ((Number) o).longValue(); }
    static double asDouble(Object o) { return ((Number) o).doubleValue(); }
    static boolean asBool(Object o) { return (Boolean) o; }
    static String asString(Object o) { return (String) o; }
    @SuppressWarnings("unchecked")
    static int[] asIntArr(Object o) { java.util.List<Object> l = (java.util.List<Object>) o; int[] r = new int[l.size()]; for (int i = 0; i < r.length; i++) r[i] = asInt(l.get(i)); return r; }
    @SuppressWarnings("unchecked")
    static long[] asLongArr(Object o) { java.util.List<Object> l = (java.util.List<Object>) o; long[] r = new long[l.size()]; for (int i = 0; i < r.length; i++) r[i] = asLong(l.get(i)); return r; }
    @SuppressWarnings("unchecked")
    static String[] asStringArr(Object o) { java.util.List<Object> l = (java.util.List<Object>) o; String[] r = new String[l.size()]; for (int i = 0; i < r.length; i++) r[i] = asString(l.get(i)); return r; }
    @SuppressWarnings("unchecked")
    static int[][] asIntMatrix(Object o) { java.util.List<Object> l = (java.util.List<Object>) o; int[][] r = new int[l.size()][]; for (int i = 0; i < r.length; i++) r[i] = asIntArr(l.get(i)); return r; }

    static String ser(String s) {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder("\"");
        for (char ch : s.toCharArray()) {
            switch (ch) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default:
                    if (ch < 0x20) b.append(String.format("\\u%04x", (int) ch)); else b.append(ch);
            }
        }
        return b.append('"').toString();
    }
    static String ser(int v) { return Integer.toString(v); }
    static String ser(long v) { return Long.toString(v); }
    static String ser(double v) { return (Double.isNaN(v) || Double.isInfinite(v)) ? "null" : Double.toString(v); }
    static String ser(boolean v) { return v ? "true" : "false"; }
    static String ser(int[] v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(','); b.append(v[i]); } return b.append(']').toString(); }
    static String ser(long[] v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(','); b.append(v[i]); } return b.append(']').toString(); }
    static String ser(String[] v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(','); b.append(ser(v[i])); } return b.append(']').toString(); }
    static String ser(int[][] v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) { if (i > 0) b.append(','); b.append(v[i] == null ? "null" : ser(v[i])); } return b.append(']').toString(); }

    static void emit(String json) { System.out.print("\n" + tag + json + "\n"); System.out.flush(); }

    @SuppressWarnings("unchecked")
    public static void main(String[] argv) throws Exception {
        java.io.BufferedReader in = new java.io.BufferedReader(new java.io.InputStreamReader(System.in, "UTF-8"));
        tag = "@@" + in.readLine().trim() + "@@";
        int count = Integer.parseInt(in.readLine().trim());
        long limit = Long.parseLong(in.readLine().trim());
        Solution sol = new Solution();
        for (int i = 0; i < count; i++) {
            String row = in.readLine();
            long began = System.nanoTime();
            try {
                text = row;
                at = 0;
                java.util.List<Object> a = (java.util.List<Object>) read();
__PARAMS__
                began = System.nanoTime();
                __RET__ r = sol.__NAME__(__ARGS__);
                long ms = (System.nanoTime() - began) / 1000000L;
__NULLCHECK__
                if (ms > limit) { emit("{\"i\":" + i + ",\"ok\":false,\"kind\":\"tle\",\"ms\":" + ms + "}"); return; }
                emit("{\"i\":" + i + ",\"ok\":true,\"result\":" + ser(r) + ",\"ms\":" + ms + "}");
            } catch (Throwable e) {
                long ms = (System.nanoTime() - began) / 1000000L;
                int line = -1;
                for (StackTraceElement el : e.getStackTrace()) {
                    if (el.getClassName().equals("Solution") || el.getClassName().startsWith("Solution$")) { line = el.getLineNumber() - __PREFIX__; break; }
                }
                String msg = e.getClass().getName() + (e.getMessage() == null ? "" : ": " + e.getMessage());
                if (msg.length() > 400) msg = msg.substring(0, 400);
                emit("{\"i\":" + i + ",\"ok\":false,\"kind\":\"runtime\",\"error\":" + ser(msg) + ",\"line\":" + (line > 0 ? Integer.toString(line) : "null") + ",\"ms\":" + ms + "}");
            }
        }
    }
}
'''

_JAVA_TYPES = {"int": "int", "long": "long", "double": "double", "bool": "boolean", "string": "String", "int[]": "int[]",
               "long[]": "long[]", "string[]": "String[]", "int[][]": "int[][]"}
_JAVA_AS = {"int": "asInt", "long": "asLong", "double": "asDouble", "bool": "asBool", "string": "asString", "int[]": "asIntArr",
            "long[]": "asLongArr", "string[]": "asStringArr", "int[][]": "asIntMatrix"}
_JAVA_OBJECT_TYPES = ("string", "int[]", "long[]", "string[]", "int[][]")


def java_type(t: str) -> str:
    return _JAVA_TYPES[t]


# ---------------------------------------------------------------------------
# C++
# ---------------------------------------------------------------------------
_CPP = r'''

// ---- platform driver: it calls your method and reports the results; it is not part of your solution ----
namespace sk_ {
inline std::string ts(long long v) { char b[32]; snprintf(b, sizeof b, "%lld", v); return b; }
struct J { char t = 'n'; bool b = false; long long i = 0; double d = 0; std::string s; std::vector<J> a; };

inline void ws(const std::string& s, size_t& p) { while (p < s.size() && (s[p] == ' ' || s[p] == '\t' || s[p] == '\r' || s[p] == '\n')) p++; }

inline void utf8(std::string& out, unsigned cp) {
    if (cp < 0x80) out += (char) cp;
    else if (cp < 0x800) { out += (char) (0xC0 | (cp >> 6)); out += (char) (0x80 | (cp & 0x3F)); }
    else { out += (char) (0xE0 | (cp >> 12)); out += (char) (0x80 | ((cp >> 6) & 0x3F)); out += (char) (0x80 | (cp & 0x3F)); }
}

inline J read(const std::string& s, size_t& p) {
    ws(s, p);
    J v;
    char c = s[p];
    if (c == '[') {
        v.t = 'a'; p++; ws(s, p);
        if (s[p] == ']') { p++; return v; }
        while (true) { v.a.push_back(read(s, p)); ws(s, p); char d = s[p++]; if (d == ']') return v; }
    }
    if (c == '"') {
        v.t = 's'; p++;
        while (true) {
            char d = s[p++];
            if (d == '"') return v;
            if (d == '\\') {
                char e = s[p++];
                switch (e) {
                    case 'n': v.s += '\n'; break;
                    case 't': v.s += '\t'; break;
                    case 'r': v.s += '\r'; break;
                    case 'b': v.s += '\b'; break;
                    case 'f': v.s += '\f'; break;
                    case 'u': utf8(v.s, (unsigned) strtoul(s.substr(p, 4).c_str(), nullptr, 16)); p += 4; break;
                    default: v.s += e;
                }
            } else v.s += d;
        }
    }
    if (s.compare(p, 4, "true") == 0) { v.t = 'b'; v.b = true; p += 4; return v; }
    if (s.compare(p, 5, "false") == 0) { v.t = 'b'; p += 5; return v; }
    if (s.compare(p, 4, "null") == 0) { p += 4; return v; }
    size_t st = p; bool isd = false;
    while (p < s.size() && std::string("+-0123456789.eE").find(s[p]) != std::string::npos) { if (s[p] == '.' || s[p] == 'e' || s[p] == 'E') isd = true; p++; }
    std::string num = s.substr(st, p - st);
    if (isd) { v.t = 'd'; v.d = strtod(num.c_str(), nullptr); } else { v.t = 'i'; v.i = strtoll(num.c_str(), nullptr, 10); }
    return v;
}

inline int asInt(const J& v) { return (int) (v.t == 'd' ? (long long) v.d : v.i); }
inline long long asLong(const J& v) { return v.t == 'd' ? (long long) v.d : v.i; }
inline double asDouble(const J& v) { return v.t == 'd' ? v.d : (double) v.i; }
inline bool asBool(const J& v) { return v.b; }
inline std::string asString(const J& v) { return v.s; }
inline std::vector<int> asIntVec(const J& v) { std::vector<int> r; for (const J& x : v.a) r.push_back(asInt(x)); return r; }
inline std::vector<long long> asLongVec(const J& v) { std::vector<long long> r; for (const J& x : v.a) r.push_back(asLong(x)); return r; }
inline std::vector<std::string> asStringVec(const J& v) { std::vector<std::string> r; for (const J& x : v.a) r.push_back(x.s); return r; }
inline std::vector<std::vector<int>> asIntMatrix(const J& v) { std::vector<std::vector<int>> r; for (const J& x : v.a) r.push_back(asIntVec(x)); return r; }

inline std::string ser(const std::string& s) {
    std::string b = "\"";
    for (unsigned char ch : s) {
        switch (ch) {
            case '"': b += "\\\""; break;
            case '\\': b += "\\\\"; break;
            case '\n': b += "\\n"; break;
            case '\r': b += "\\r"; break;
            case '\t': b += "\\t"; break;
            default:
                if (ch < 0x20) { char buf[8]; snprintf(buf, sizeof buf, "\\u%04x", (int) ch); b += buf; } else b += (char) ch;
        }
    }
    return b + "\"";
}
inline std::string ser(int v) { return sk_::ts(v); }
inline std::string ser(long long v) { return sk_::ts(v); }
inline std::string ser(double v) { if (v != v || v - v != 0) return "null"; char buf[40]; snprintf(buf, sizeof buf, "%.17g", v); return buf; }
inline std::string ser(bool v) { return v ? "true" : "false"; }
inline std::string ser(const std::vector<int>& v);
inline std::string ser(const std::vector<long long>& v);
inline std::string ser(const std::vector<std::string>& v);
inline std::string ser(const std::vector<std::vector<int>>& v);
template <class T> inline std::string serVec(const std::vector<T>& v) { std::string b = "["; for (size_t i = 0; i < v.size(); i++) { if (i) b += ","; b += ser(v[i]); } return b + "]"; }
inline std::string ser(const std::vector<int>& v) { return serVec(v); }
inline std::string ser(const std::vector<long long>& v) { return serVec(v); }
inline std::string ser(const std::vector<std::string>& v) { return serVec(v); }
inline std::string ser(const std::vector<std::vector<int>>& v) { return serVec(v); }

inline void emit(const std::string& tag, const std::string& json) { std::cout << "\n" << tag << json << "\n" << std::flush; }
}  // namespace sk_

int main() {
    std::string row;
    std::getline(std::cin, row);
    std::string tag = "@@" + row.substr(0, row.find_last_not_of(" \r\n") + 1) + "@@";
    std::getline(std::cin, row);
    int count = atoi(row.c_str());
    std::getline(std::cin, row);
    long long limit = atoll(row.c_str());
    Solution sol;
    for (int i = 0; i < count; i++) {
        std::getline(std::cin, row);
        auto began = std::chrono::steady_clock::now();
        try {
            size_t p = 0;
            sk_::J a = sk_::read(row, p);
__PARAMS__
            began = std::chrono::steady_clock::now();
            __RET__ r = sol.__NAME__(__ARGS__);
            long long ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - began).count();
            if (ms > limit) { sk_::emit(tag, "{\"i\":" + sk_::ts(i) + ",\"ok\":false,\"kind\":\"tle\",\"ms\":" + sk_::ts(ms) + "}"); return 0; }
            sk_::emit(tag, "{\"i\":" + sk_::ts(i) + ",\"ok\":true,\"result\":" + sk_::ser(r) + ",\"ms\":" + sk_::ts(ms) + "}");
        } catch (const std::exception& e) {
            long long ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - began).count();
            sk_::emit(tag, "{\"i\":" + sk_::ts(i) + ",\"ok\":false,\"kind\":\"runtime\",\"error\":" + sk_::ser(std::string("exception: ") + e.what()) + ",\"ms\":" + sk_::ts(ms) + "}");
        } catch (...) {
            sk_::emit(tag, "{\"i\":" + sk_::ts(i) + ",\"ok\":false,\"kind\":\"runtime\",\"error\":\"exception thrown\",\"ms\":0}");
        }
    }
    return 0;
}
'''

_CPP_TYPES = {"int": "int", "long": "long long", "double": "double", "bool": "bool", "string": "std::string", "int[]": "std::vector<int>",
              "long[]": "std::vector<long long>", "string[]": "std::vector<std::string>", "int[][]": "std::vector<std::vector<int>>"}
_CPP_AS = {"int": "asInt", "long": "asLong", "double": "asDouble", "bool": "asBool", "string": "asString", "int[]": "asIntVec",
           "long[]": "asLongVec", "string[]": "asStringVec", "int[][]": "asIntMatrix"}


def cpp_type(t: str) -> str:
    return _CPP_TYPES[t]


# ---------------------------------------------------------------------------
# C
# ---------------------------------------------------------------------------
_C = r'''

/* ---- platform driver: it calls your function and reports the results; it is not part of your solution ---- */
static const char* sk_p;
static void sk_ws(void) { while (*sk_p == ' ' || *sk_p == '\t' || *sk_p == '\r' || *sk_p == '\n') sk_p++; }
static void sk_comma(void) { sk_ws(); if (*sk_p == ',') sk_p++; }
static long long sk_ll(void) { char* e; sk_ws(); long long v = strtoll(sk_p, &e, 10); sk_p = e; return v; }
static double sk_dbl(void) { char* e; sk_ws(); double v = strtod(sk_p, &e); sk_p = e; return v; }
static int sk_bool(void) { sk_ws(); if (strncmp(sk_p, "true", 4) == 0) { sk_p += 4; return 1; } sk_p += 5; return 0; }
static char* sk_str(void) {
    size_t cap = 64, n = 0;
    char* b = (char*) malloc(cap);
    sk_ws();
    sk_p++;
    while (*sk_p && *sk_p != '"') {
        char ch = *sk_p++;
        if (ch == '\\') {
            char e = *sk_p++;
            switch (e) {
                case 'n': ch = '\n'; break;
                case 't': ch = '\t'; break;
                case 'r': ch = '\r'; break;
                case 'b': ch = '\b'; break;
                case 'f': ch = '\f'; break;
                case 'u': { unsigned cp = 0; for (int k = 0; k < 4; k++) { char h = *sk_p++; cp = cp * 16 + (h <= '9' ? h - '0' : (h | 32) - 'a' + 10); } ch = (char) cp; break; }
                default: ch = e;
            }
        }
        if (n + 2 > cap) { cap *= 2; b = (char*) realloc(b, cap); }
        b[n++] = ch;
    }
    sk_p++;
    b[n] = 0;
    return b;
}
static int* sk_arr(int* count) {
    size_t cap = 16, n = 0;
    int* b = (int*) malloc(cap * sizeof(int));
    sk_ws();
    sk_p++;
    sk_ws();
    if (*sk_p == ']') { sk_p++; *count = 0; return b; }
    while (1) {
        if (n + 1 > cap) { cap *= 2; b = (int*) realloc(b, cap * sizeof(int)); }
        b[n++] = (int) sk_ll();
        sk_ws();
        if (*sk_p == ',') { sk_p++; continue; }
        sk_p++;
        break;
    }
    *count = (int) n;
    return b;
}
static char* sk_line(void) {
    size_t cap = 1 << 16, n = 0;
    char* b = (char*) malloc(cap);
    b[0] = 0;
    while (fgets(b + n, (int) (cap - n), stdin)) {
        n += strlen(b + n);
        if (n > 0 && b[n - 1] == '\n') break;
        if (cap - n < 2) { cap *= 2; b = (char*) realloc(b, cap); }
    }
    return b;
}
static void sk_print_str(const char* s) {
    putchar('"');
    for (; *s; s++) {
        unsigned char ch = (unsigned char) *s;
        if (ch == '"') fputs("\\\"", stdout);
        else if (ch == '\\') fputs("\\\\", stdout);
        else if (ch == '\n') fputs("\\n", stdout);
        else if (ch == '\r') fputs("\\r", stdout);
        else if (ch == '\t') fputs("\\t", stdout);
        else if (ch < 0x20) printf("\\u%04x", ch);
        else putchar(ch);
    }
    putchar('"');
}

int main(void) {
    char* l1 = sk_line();
    char tag[96];
    size_t t = strlen(l1);
    while (t > 0 && (l1[t - 1] == '\n' || l1[t - 1] == '\r' || l1[t - 1] == ' ')) l1[--t] = 0;
    snprintf(tag, sizeof tag, "@@%s@@", l1);
    int count = atoi(sk_line());
    long long limit = atoll(sk_line());
    for (int i = 0; i < count; i++) {
        sk_p = sk_line();
        sk_ws();
        sk_p++;
__PARAMS__
        clock_t began = clock();
        __CALL__
        long long ms = (long long) ((clock() - began) * 1000.0 / CLOCKS_PER_SEC);
__NULLCHECK__
        if (ms > limit) { printf("\n%s{\"i\":%d,\"ok\":false,\"kind\":\"tle\",\"ms\":%lld}\n", tag, i, ms); fflush(stdout); return 0; }
        printf("\n%s{\"i\":%d,\"ok\":true,\"result\":", tag, i);
__PRINT__
        printf(",\"ms\":%lld}\n", ms);
        fflush(stdout);
    }
    return 0;
}
'''

_C_TYPES = {"int": "int", "long": "long long", "double": "double", "bool": "bool", "string": "char*"}
_C_NOTHING = '{ printf("\\n%s{\\"i\\":%d,\\"ok\\":false,\\"kind\\":\\"nothing\\",\\"error\\":\\"Your function returned nothing\\",\\"ms\\":%lld}\\n", tag, i, ms); fflush(stdout); continue; }'


def _c_params(sig: Signature) -> Tuple[str, str]:
    decls, args = [], []
    for n, (name, t) in enumerate(sig.params):
        v = f"p{n}"
        if t == "int":
            decls.append(f"        int {v} = (int) sk_ll(); sk_comma();")
        elif t == "long":
            decls.append(f"        long long {v} = sk_ll(); sk_comma();")
        elif t == "double":
            decls.append(f"        double {v} = sk_dbl(); sk_comma();")
        elif t == "bool":
            decls.append(f"        bool {v} = sk_bool() != 0; sk_comma();")
        elif t == "string":
            decls.append(f"        char* {v} = sk_str(); sk_comma();")
        else:  # int[]
            decls.append(f"        int {v}n = 0; int* {v} = sk_arr(&{v}n); sk_comma();")
            args.append(v)
            args.append(f"{v}n")
            continue
        args.append(v)
    return "\n".join(decls), ", ".join(args)


def _c_driver(sig: Signature) -> str:
    decls, args = _c_params(sig)
    r = sig.returns
    if r == "int[]":
        call = f"int rn = 0; int* r = {sig.snake_name}({args + ', ' if args else ''}&rn);"
        nullcheck = f"        if (r == NULL) {_C_NOTHING}"
        printer = '        putchar(\'[\'); for (int k = 0; k < rn; k++) { if (k) putchar(\',\'); printf("%d", r[k]); } putchar(\']\');'
    elif r == "string":
        call = f"char* r = {sig.snake_name}({args});"
        nullcheck = f"        if (r == NULL) {_C_NOTHING}"
        printer = "        sk_print_str(r);"
    else:
        call = f"{_C_TYPES[r]} r = {sig.snake_name}({args});"
        nullcheck = ""
        printer = {
            "int": '        printf("%d", r);',
            "long": '        printf("%lld", r);',
            "double": '        if (r != r || r - r != 0) fputs("null", stdout); else printf("%.17g", r);',
            "bool": '        fputs(r ? "true" : "false", stdout);',
        }[r]
    return _C.replace("__PARAMS__", decls).replace("__CALL__", call).replace("__NULLCHECK__", nullcheck).replace("__PRINT__", printer)


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------
_PREFIX = {
    "python": "",
    "javascript": "",
    "java": "import java.util.*;\nimport java.io.*;\n",
    "cpp": "#include <bits/stdc++.h>\nusing namespace std;\n",
    "c": "#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>\n#include <ctype.h>\n#include <math.h>\n#include <time.h>\n",
}


def prefix_line_count(language: str) -> int:
    return _PREFIX[language].count("\n")


def _java_driver(sig: Signature) -> str:
    params, args = [], []
    for n, (name, t) in enumerate(sig.params):
        params.append(f"                {java_type(t)} p{n} = {_JAVA_AS[t]}(a.get({n}));")
        args.append(f"p{n}")
    nullcheck = ""
    if sig.returns in _JAVA_OBJECT_TYPES:
        nullcheck = ('                if (r == null) { emit("{\\"i\\":" + i + ",\\"ok\\":false,\\"kind\\":\\"nothing\\",'
                     '\\"error\\":\\"Your function returned nothing\\",\\"ms\\":" + ms + "}"); continue; }')
    return (_JAVA.replace("__PARAMS__", "\n".join(params)).replace("__RET__", java_type(sig.returns)).replace("__NAME__", sig.name)
            .replace("__ARGS__", ", ".join(args)).replace("__NULLCHECK__", nullcheck))


def _cpp_driver(sig: Signature) -> str:
    params, args = [], []
    for n, (name, t) in enumerate(sig.params):
        params.append(f"            {cpp_type(t)} p{n} = sk_::{_CPP_AS[t]}(a.a[{n}]);")
        args.append(f"p{n}")
    return _CPP.replace("__PARAMS__", "\n".join(params)).replace("__RET__", cpp_type(sig.returns)).replace("__NAME__", sig.name).replace("__ARGS__", ", ".join(args))


def build_program(language: str, sig: Signature, student_code: str) -> Program:
    """The complete source to send to the compiler: [prefix] + student's code + driver."""
    if language not in _PREFIX:
        raise ValueError(f"Unsupported language '{language}'")
    code = student_code.replace("\r\n", "\n").replace("\r", "\n")
    if not code.endswith("\n"):
        code += "\n"
    student_lines = code.count("\n")
    prefix = _PREFIX[language]
    if language == "python":
        driver = _PY.replace("__NAME__", sig.snake_name).replace("__STUDENT_LINES__", str(student_lines))
    elif language == "javascript":
        driver = _JS.replace("__NAME__", sig.name).replace("__STUDENT_LINES__", str(student_lines))
    elif language == "java":
        driver = _java_driver(sig).replace("__PREFIX__", str(prefix.count("\n")))
    elif language == "cpp":
        driver = _cpp_driver(sig)
    elif language == "c":
        if not sig.c_available:
            raise ValueError(sig.c_disabled_reason)
        driver = _c_driver(sig)
    else:
        raise ValueError(f"Unsupported language '{language}'")
    return Program(source=prefix + code + driver, prefix_lines=prefix.count("\n"), student_lines=student_lines)
