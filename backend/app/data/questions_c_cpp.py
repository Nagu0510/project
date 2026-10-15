"""Original C and C++ questions (20 each: 6 Easy, 8 Medium, 6 Hard).

Code Output questions carry a complete program in `code`. Their answers were checked by reasoning and then by compiling and running
every program (backend/scripts/validate_questions.py --online). Reviewed: yes.
"""
from app.data.qhelp import q

C_QUESTIONS = [
    # ---- Easy ----
    q("c-01", "C", "Basics & Types", "Easy", "Conceptual",
      "Which format specifier prints an `int` with printf?", ["%f", "%d", "%s", "%c"], 1,
      "%d prints a signed decimal integer. %f is for floating point, %s for strings and %c for a single character."),
    q("c-02", "C", "Operators & Control Flow", "Easy", "Code Output",
      "What does this program print?", ["3 1", "3.5 1", "3 3", "4 1"], 0,
      "Both operands are int, so 7 / 2 is integer division (3) and 7 % 2 is the remainder (1).",
      code=r"""
#include <stdio.h>

int main(void) {
    int a = 7, b = 2;
    printf("%d %d\n", a / b, a % b);
    return 0;
}
"""),
    q("c-03", "C", "Arrays & Strings", "Easy", "Conceptual",
      "What marks the end of a C string stored in a char array?",
      ["The newline character", "The null character '\\0'", "A space", "A length stored at index 0"], 1,
      "C strings are arrays of char ended by the null character '\\0'. Functions like strlen and printf(\"%s\") rely on it."),
    q("c-04", "C", "Operators & Control Flow", "Easy", "Find the Error",
      "The programmer wanted to test whether x equals 10. What is wrong with this condition?",
      ["`=` assigns 10 to x, so the condition is always true", "`if` needs braces around the condition", "x must be declared float", "printf cannot be used inside if"], 0,
      "A single = is assignment. The expression x = 10 has the value 10 (non-zero), so the branch always runs. Comparison needs ==.",
      code=r"""
int x = 5;
if (x = 10) {
    printf("ten");
}
"""),
    q("c-05", "C", "Functions & Recursion", "Easy", "Conceptual",
      "By default, how does C pass arguments to a function?",
      ["By value: the function gets a copy", "By reference", "Arrays are copied element by element", "Pointers cannot be passed"], 0,
      "C always passes by value. To let a function change the caller's variable you pass its address (a pointer)."),
    q("c-06", "C", "Basics & Types", "Easy", "Code Output",
      "What does this program print?", ["66 B", "A B", "65 A", "B 66"], 0,
      "A char is promoted to int in c + 1. 'A' is 65, so c + 1 is 66; %d prints 66 and %c prints the character with code 66, which is 'B'.",
      code=r"""
#include <stdio.h>

int main(void) {
    char c = 'A';
    printf("%d %c\n", c + 1, c + 1);
    return 0;
}
"""),
    # ---- Medium ----
    q("c-07", "C", "Pointers", "Medium", "Code Output",
      "What does this program print?", ["10", "15", "The address of a", "Compile error"], 1,
      "p points at a, so *p = *p + 5 changes a itself from 10 to 15.",
      code=r"""
#include <stdio.h>

int main(void) {
    int a = 10;
    int *p = &a;
    *p = *p + 5;
    printf("%d\n", a);
    return 0;
}
"""),
    q("c-08", "C", "Pointers", "Medium", "Conceptual",
      "Given `int arr[5]; int *p = arr;`, which expression is equivalent to `*(p + 2)`?",
      ["arr[2]", "arr[3]", "&arr[2]", "arr + 2"], 0,
      "Pointer arithmetic scales by the element size, so p + 2 points at arr[2] and dereferencing it gives arr[2]."),
    q("c-09", "C", "Arrays & Strings", "Medium", "Code Output",
      "What does this program print?", ["5 5", "6 5", "6 6", "5 6"], 1,
      "sizeof(s) counts every byte of the array, including the terminating '\\0' (6), while strlen stops before it (5).",
      code=r"""
#include <stdio.h>
#include <string.h>

int main(void) {
    char s[] = "hello";
    printf("%zu %zu\n", sizeof(s), strlen(s));
    return 0;
}
"""),
    q("c-10", "C", "Memory Management", "Medium", "Find the Error",
      "What is the problem with this code?",
      ["Use after free: p is a dangling pointer after free(p)", "malloc cannot allocate ints", "free must be called twice", "p[0] must be written *p[0]"], 0,
      "After free(p) the memory is no longer yours. Reading p[0] is undefined behaviour. Set p = NULL after freeing.",
      code=r"""
int *p = malloc(3 * sizeof(int));
p[0] = 1;
free(p);
printf("%d", p[0]);
"""),
    q("c-11", "C", "Functions & Recursion", "Medium", "Code Output",
      "What does this program print?", ["24", "120", "5", "15"], 1,
      "f computes the factorial: 5 * 4 * 3 * 2 * 1 = 120.",
      code=r"""
#include <stdio.h>

int f(int n) {
    if (n <= 1) return 1;
    return n * f(n - 1);
}

int main(void) {
    printf("%d\n", f(5));
    return 0;
}
"""),
    q("c-12", "C", "Operators & Control Flow", "Medium", "Code Output",
      "What does this program print?", ["two", "two three end", "two end", "one two three end"], 1,
      "There is no break, so execution falls through from case 2 into case 3 and the default branch.",
      code=r"""
#include <stdio.h>

int main(void) {
    int x = 2;
    switch (x) {
        case 1: printf("one ");
        case 2: printf("two ");
        case 3: printf("three ");
        default: printf("end");
    }
    printf("\n");
    return 0;
}
"""),
    q("c-13", "C", "Structs & Files", "Medium", "Conceptual",
      "Besides the sizes of its members, what else can make `sizeof` a struct larger?",
      ["Padding added by the compiler for alignment", "The order in which it is printed", "The file it is defined in", "Nothing: it is always the plain sum of the members"], 0,
      "Compilers insert padding bytes so members sit at aligned addresses, so a struct can be bigger than the sum of its members."),
    q("c-14", "C", "Preprocessor", "Medium", "Code Output",
      "What does this program print?", ["25", "11", "10", "13"], 1,
      "Macros are text substitution: SQUARE(2 + 3) becomes 2 + 3 * 2 + 3, which is 2 + 6 + 3 = 11. Parenthesise macro arguments.",
      code=r"""
#include <stdio.h>
#define SQUARE(x) x * x

int main(void) {
    printf("%d\n", SQUARE(2 + 3));
    return 0;
}
"""),
    # ---- Hard ----
    q("c-15", "C", "Pointers", "Hard", "Code Output",
      "What does this program print?", ["30 2", "20 2", "30 8", "20 1"], 0,
      "p starts at a[0]; p += 2 moves it to a[2] (30). Subtracting pointers gives the distance in elements, 2, not bytes.",
      code=r"""
#include <stdio.h>

int main(void) {
    int a[] = {10, 20, 30, 40};
    int *p = a;
    p += 2;
    printf("%d %ld\n", *p, (long)(p - a));
    return 0;
}
"""),
    q("c-16", "C", "Memory Management", "Hard", "Scenario",
      "A program calls malloc in a loop and never frees the blocks. Its memory use grows until the process is killed. What is this called, and what helps find it?",
      ["A memory leak; use Valgrind or AddressSanitizer", "A stack overflow; raise the stack limit", "A buffer overflow; add more RAM", "A race condition; add a mutex"], 0,
      "Memory that is allocated and never released is a leak. Tools such as Valgrind (memcheck) and AddressSanitizer report where leaked blocks were allocated."),
    q("c-17", "C", "Pointers", "Hard", "Find the Error",
      "What happens when this code runs?",
      ["Undefined behaviour: string literals are read-only", "s becomes \"Hello\"", "Compile error: char* cannot be indexed", "s[0] is converted to a number first"], 0,
      "A pointer to a string literal must not be used to modify it. Use `char s[] = \"hello\";` if you need a writable copy.",
      code=r"""
char *s = "hello";
s[0] = 'H';
"""),
    q("c-18", "C", "Functions & Recursion", "Hard", "Code Output",
      "What does this program print?", ["4 2", "4 6", "4 4", "6 6"], 1,
      "calls is static, so it keeps counting across calls. g(3) makes 4 calls (n = 3, 2, 1, 0) and returns 4. g(1) then makes 2 more calls and returns the running total 6.",
      code=r"""
#include <stdio.h>

int g(int n) {
    static int calls = 0;
    calls++;
    if (n == 0) return calls;
    return g(n - 1);
}

int main(void) {
    int a = g(3);
    int b = g(1);
    printf("%d %d\n", a, b);
    return 0;
}
"""),
    q("c-19", "C", "Arrays & Strings", "Hard", "Code Output",
      "On a 64-bit system where pointers are 8 bytes, what does this program print?", ["40", "8", "10", "4"], 1,
      "An array parameter decays to a pointer, so sizeof(arr) inside f is the size of a pointer (8), not the size of the original array (40).",
      code=r"""
#include <stdio.h>

void f(int arr[]) {
    printf("%zu\n", sizeof(arr));
}

int main(void) {
    int a[10];
    f(a);
    return 0;
}
"""),
    q("c-20", "C", "Structs & Files", "Hard", "Scenario",
      "You read a struct with fread from a binary file written by a program on another machine, and the field values look scrambled. What is the most likely cause?",
      ["Different endianness or struct padding between the machines", "fread cannot read structs", "The file was opened in text mode only", "free() was called twice"], 0,
      "Binary layouts depend on byte order and padding. Write and read fields one by one in a defined format instead of dumping the raw struct.",
      practice=False),
]

CPP_QUESTIONS = [
    # ---- Easy ----
    q("cpp-01", "C++", "Language Basics", "Easy", "Conceptual",
      "Which header provides `std::cout`?", ["<iostream>", "<stdio.h>", "<string>", "<cout>"], 0,
      "std::cout and std::cin are declared in <iostream>."),
    q("cpp-02", "C++", "References & Pointers", "Easy", "Code Output",
      "What does this program print?", ["5", "9", "An address", "Compile error"], 1,
      "r is a reference to a, an alias for the same variable, so assigning to r changes a.",
      code=r"""
#include <iostream>
using namespace std;

int main() {
    int a = 5;
    int &r = a;
    r = 9;
    cout << a;
    return 0;
}
"""),
    q("cpp-03", "C++", "Classes & Objects", "Easy", "Conceptual",
      "What is the default access level of members in a C++ `class` (not a `struct`)?", ["public", "private", "protected", "package"], 1,
      "Members of a class are private by default; members of a struct are public by default."),
    q("cpp-04", "C++", "Classes & Objects", "Easy", "Find the Error",
      "Why does this code fail to compile?",
      ["There is no default constructor because Box(int) was declared", "w is private so a Box cannot be created", "main must return a Box", "Constructors cannot take arguments"], 0,
      "Declaring any constructor stops the compiler from generating the default one. `Box b;` needs Box() or a default argument.",
      code=r"""
class Box {
    int w;
public:
    Box(int x) { w = x; }
};

int main() {
    Box b;
}
"""),
    q("cpp-05", "C++", "Templates & STL", "Easy", "Conceptual",
      "Which standard container stores unique keys in sorted order?", ["std::set", "std::vector", "std::unordered_set", "std::list"], 0,
      "std::set keeps unique elements ordered (usually a balanced tree). unordered_set is unique but unordered."),
    q("cpp-06", "C++", "Language Basics", "Easy", "Code Output",
      "What does this program print?", ["10 10", "11 10", "11 11", "10 11"], 1,
      "x++ yields the old value (10) for y and then increments x to 11, so x is 11 and y is 10.",
      code=r"""
#include <iostream>
using namespace std;

int main() {
    int x = 10;
    int y = x++;
    cout << x << " " << y;
    return 0;
}
"""),
    # ---- Medium ----
    q("cpp-07", "C++", "Inheritance & Polymorphism", "Medium", "Code Output",
      "What does this program print?", ["A", "B", "AB", "Compile error"], 1,
      "f is virtual, so the call through the base reference runs the override in B.",
      code=r"""
#include <iostream>
using namespace std;

struct A { virtual void f() { cout << "A"; } };
struct B : A { void f() override { cout << "B"; } };

int main() {
    B b;
    A& r = b;
    r.f();
    return 0;
}
"""),
    q("cpp-08", "C++", "Inheritance & Polymorphism", "Medium", "Conceptual",
      "Why should a base class that may be deleted through a base pointer have a virtual destructor?",
      ["So the derived destructor also runs", "So the base can be copied", "So templates work", "To make the class abstract"], 0,
      "Deleting a derived object through a base pointer without a virtual destructor is undefined behaviour; derived members may never be destroyed."),
    q("cpp-09", "C++", "Templates & STL", "Medium", "Code Output",
      "What does this program print?", ["13", "31", "12", "32"], 0,
      "After sort the vector is 1, 2, 3, so v[0] is 1 and v[2] is 3.",
      code=r"""
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> v = {3, 1, 2};
    sort(v.begin(), v.end());
    cout << v[0] << v[2];
    return 0;
}
"""),
    q("cpp-10", "C++", "References & Pointers", "Medium", "Find the Error",
      "What is wrong with this function?",
      ["It returns a reference to a local variable that no longer exists", "get cannot return int&", "local must be static", "References cannot be returned"], 0,
      "local is destroyed when get returns, so the reference dangles. Return by value instead.",
      code=r"""
int& get() {
    int local = 5;
    return local;
}
"""),
    q("cpp-11", "C++", "Memory & RAII", "Medium", "Conceptual",
      "What does RAII mean in C++?",
      ["Resource lifetime is tied to object lifetime: acquire in the constructor, release in the destructor", "Run-time Allocation Is Immediate", "Reference Arguments Are Immutable", "Reusable Abstract Interface Idiom"], 0,
      "RAII makes cleanup automatic and exception-safe. Smart pointers, lock guards and file streams all use it."),
    q("cpp-12", "C++", "Classes & Objects", "Medium", "Code Output",
      "What does this program print?", ["+x+y-x-y", "+x+y-y-x", "+x-x+y-y", "+y+x-x-y"], 1,
      "Objects are constructed in declaration order (x then y) and destroyed in reverse order (y then x) when main ends.",
      code=r"""
#include <iostream>
#include <string>
using namespace std;

struct T {
    string n;
    T(string s) : n(s) { cout << "+" << n; }
    ~T() { cout << "-" << n; }
};

int main() {
    T a("x");
    T b("y");
    return 0;
}
"""),
    q("cpp-13", "C++", "Operators & Overloading", "Medium", "Conceptual",
      "Which operator must be overloaded as a member function?",
      ["The assignment operator =", "The + operator", "The << stream insertion operator", "The == operator"], 0,
      "The operators =, [], () and -> can only be overloaded as member functions. + , == and << may be free (friend) functions."),
    q("cpp-14", "C++", "Templates & STL", "Medium", "Code Output",
      "What does this program print?", ["312", "213", "321", "311"], 0,
      "m[\"a\"] becomes 2 then 3, m[\"b\"] becomes 1, and the map holds 2 keys, so the output is 3, 1, 2.",
      code=r"""
#include <iostream>
#include <map>
#include <string>
using namespace std;

int main() {
    map<string, int> m;
    m["a"] += 2;
    m["b"]++;
    m["a"]++;
    cout << m["a"] << m["b"] << m.size();
    return 0;
}
"""),
    # ---- Hard ----
    q("cpp-15", "C++", "Memory & RAII", "Hard", "Scenario",
      "A function creates an object with `new`, and an exception is thrown before the matching `delete`. Which approach prevents the leak?",
      ["Own the object with std::unique_ptr", "Call delete in main", "Use malloc instead of new", "Catch the exception and ignore it"], 0,
      "A unique_ptr releases the object in its destructor during stack unwinding, so the object is freed even when an exception escapes."),
    q("cpp-16", "C++", "Inheritance & Polymorphism", "Hard", "Code Output",
      "What does this program print?", ["A", "B", "AB", "Compile error"], 0,
      "show takes its parameter by value, so the B object is sliced into an A. The virtual call on the copy runs A::name.",
      code=r"""
#include <iostream>
#include <string>
using namespace std;

struct A { virtual string name() const { return "A"; } };
struct B : A { string name() const override { return "B"; } };

void show(A a) { cout << a.name(); }

int main() {
    B b;
    show(b);
    return 0;
}
"""),
    q("cpp-17", "C++", "Templates & STL", "Hard", "Find the Error",
      "What is the risk in this loop?",
      ["push_back may reallocate the vector and invalidate the iterator", "vector cannot hold ints", "it must be const", "v.end() is a constant so the loop never ends"], 0,
      "Growing a vector can move its storage, which invalidates iterators into it. Using an invalidated iterator is undefined behaviour.",
      code=r"""
vector<int> v = {1, 2, 3};
for (auto it = v.begin(); it != v.end(); ++it) {
    if (*it == 2) v.push_back(4);
}
"""),
    q("cpp-18", "C++", "Language Basics", "Hard", "Code Output",
      "What does this program print?", ["15", "55", "11", "51"], 0,
      "The lambda [x] copies x when it is created (1). [&x] refers to the live variable, which is 5 when it is called.",
      code=r"""
#include <iostream>
using namespace std;

int main() {
    int x = 1;
    auto byVal = [x]() { return x; };
    auto byRef = [&x]() { return x; };
    x = 5;
    int a = byVal();
    int b = byRef();
    cout << a << b;
    return 0;
}
"""),
    q("cpp-19", "C++", "Operators & Overloading", "Hard", "Conceptual",
      "What does the Rule of Three say?",
      ["If a class needs a custom destructor, copy constructor or copy assignment operator, it probably needs all three", "A class may have at most three constructors", "Templates may have three parameters", "Virtual functions need three overrides"], 0,
      "A class that manages a resource usually must define destructor, copy constructor and copy assignment together (the Rule of Five adds move operations)."),
    q("cpp-20", "C++", "Exceptions", "Hard", "Code Output",
      "What does this program print?", ["RC", "CR", "C", "R"], 0,
      "During stack unwinding the local object r is destroyed (printing R) before the catch handler body runs (printing C).",
      code=r"""
#include <iostream>
using namespace std;

struct R { ~R() { cout << "R"; } };

void f() {
    R r;
    throw 1;
}

int main() {
    try { f(); }
    catch (int) { cout << "C"; }
    return 0;
}
""", practice=False),
]
