"""Skill catalog for the resume analyzer.

Each skill has a canonical name, a category, aliases, and optionally AMBIGUOUS aliases: short words that are also
ordinary words or letters (c, r, go, os, ml, dl, rest, node, spring, py ...). An ambiguous alias counts only inside
a Skills section (or on a "Languages: ..." style line), or when a CONTEXT pattern makes it unmistakable
("C programming", "C/C++", "REST API", "Operating Systems"). That is what keeps "C. Education" from being read as
the C language and "OS" in a sentence from being read as Operating Systems.

REQUIREMENT_MAP turns the free-text labels in career_config's required_skills ("Python/Java", "AWS / GCP",
"CI/CD (GitHub Actions)") into the catalog skills that satisfy them.
"""
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass(frozen=True)
class Skill:
    name: str
    category: str
    aliases: Tuple[str, ...] = ()
    ambiguous_aliases: Tuple[str, ...] = ()
    context: Tuple[str, ...] = ()  # regexes (lowercase text) that count even when the alias itself is ambiguous

    @property
    def ambiguous(self) -> bool:
        return bool(self.ambiguous_aliases)


def _s(name: str, category: str, aliases: str = "", ambiguous: str = "", context: Tuple[str, ...] = ()) -> Skill:
    split = lambda value: tuple(a.strip() for a in value.split("|") if a.strip())  # noqa: E731
    return Skill(name, category, split(aliases), split(ambiguous), context)


SKILLS: List[Skill] = [
    # Languages
    _s("C", "Language", ambiguous="c", context=(
        r"\bc\s+programming\b", r"\bc\s+language\b", r"\bansi\s+c\b", r"\bc\s*/\s*c\+\+", r"\bc\+\+\s*/\s*c\b",
        r"\bc\s+and\s+c\+\+", r"\bc\s*,\s*c\+\+")),
    _s("C++", "Language", "c++|cpp"),
    _s("C#", "Language", "c#|c sharp|csharp"),
    _s(".NET", "Backend", ".net|asp.net|dotnet|.net core"),
    _s("Python", "Language", "python|python3|python 3", "py"),
    _s("Java", "Language", "java|core java"),
    _s("JavaScript", "Language", "javascript|js|ecmascript|es6"),
    _s("TypeScript", "Language", "typescript", "ts"),
    _s("Go", "Language", "golang", "go"),
    _s("R", "Language", "r programming|r language", "r"),
    _s("PHP", "Language", "php"),
    _s("Kotlin", "Language", "kotlin"),
    _s("Shell/Bash", "Language", "bash|shell scripting|shell script"),
    # Frontend
    _s("HTML", "Frontend", "html|html5"),
    _s("CSS", "Frontend", "css|css3|scss|sass"),
    _s("React", "Frontend", "react|reactjs|react.js|react js"),
    _s("Next.js", "Frontend", "next.js|nextjs|next js"),
    _s("Angular", "Frontend", "angular|angularjs"),
    _s("Vue.js", "Frontend", "vue|vue.js|vuejs"),
    _s("Tailwind CSS", "Frontend", "tailwind|tailwindcss|tailwind css"),
    _s("Bootstrap", "Frontend", "bootstrap"),
    _s("Redux", "Frontend", "redux"),
    _s("Responsive Design", "Frontend", "responsive design|responsive web|responsive layouts|mobile-first|media queries"),
    # Backend
    _s("Node.js", "Backend", "node.js|nodejs|node js", "node"),
    _s("Express.js", "Backend", "express.js|expressjs", "express"),
    _s("Django", "Backend", "django"),
    _s("Flask", "Backend", "flask"),
    _s("FastAPI", "Backend", "fastapi"),
    _s("Spring Boot", "Backend", "spring boot|springboot|spring framework", "spring"),
    _s("REST API", "Backend", "rest api|rest apis|restful|restful api|restful apis|rest-api|rest services", "rest",
       ("\\brest\\s+api", "\\brestful\\b")),
    _s("GraphQL", "Backend", "graphql"),
    _s("Authentication", "Backend", "authentication|authorization|jwt|oauth|oauth2|session management"),
    _s("Microservices", "Backend", "microservices|microservice"),
    _s("Backend Development", "Backend", "backend development|backend developer|backend engineer|server-side"),
    # Databases
    _s("SQL", "Database", "sql|t-sql|pl/sql"),
    _s("MySQL", "Database", "mysql"),
    _s("PostgreSQL", "Database", "postgresql|postgres"),
    _s("SQLite", "Database", "sqlite"),
    _s("MongoDB", "Database", "mongodb|mongo db|mongoose", "mongo"),
    _s("Redis", "Database", "redis"),
    _s("Firebase", "Database", "firebase|firestore"),
    _s("DBMS", "Core CS", "dbms|rdbms|database management system|database management systems|database management"),
    _s("JDBC", "Core CS", "jdbc|hibernate|jpa"),
    # Core computer science
    _s("DSA", "Core CS", "dsa|data structures|data structure|algorithms|data structures and algorithms|competitive programming"),
    _s("OOP", "Core CS", "oop|oops|object oriented|object-oriented|object oriented programming"),
    _s("Operating Systems", "Core CS", "operating systems|operating system", "os"),
    _s("Computer Networks", "Core CS", "computer networks|computer networking|networking|tcp/ip|tcp ip"),
    _s("System Design", "Core CS", "system design|low level design|high level design"),
    _s("Multithreading", "Core CS", "multithreading|multi-threading|multithreaded|concurrency"),
    _s("Exception Handling", "Core CS", "exception handling|error handling|try-catch|try/except"),
    _s("File Handling", "Core CS", "file handling|file i/o|file io"),
    _s("Collections", "Core CS", "collections|collection framework|java collections|hashmap|hashset|arraylist"),
    _s("Functions", "Core CS", "functions|lambda functions"),
    # Data and AI
    _s("NumPy", "Data/AI", "numpy"),
    _s("Pandas", "Data/AI", "pandas"),
    _s("Matplotlib", "Data/AI", "matplotlib"),
    _s("Seaborn", "Data/AI", "seaborn"),
    _s("Scikit-learn", "Data/AI", "scikit-learn|scikit learn|sklearn"),
    _s("TensorFlow", "Data/AI", "tensorflow"),
    _s("Keras", "Data/AI", "keras"),
    _s("PyTorch", "Data/AI", "pytorch"),
    _s("OpenCV", "Data/AI", "opencv"),
    _s("Machine Learning", "Data/AI", "machine learning", "ml"),
    _s("Deep Learning", "Data/AI", "deep learning|neural networks|neural network", "dl"),
    _s("NLP", "Data/AI", "nlp|natural language processing"),
    _s("Computer Vision", "Data/AI", "computer vision|image processing"),
    _s("Generative AI", "Data/AI", "generative ai|gen ai|genai|llm|llms|large language models|langchain|prompt engineering"),
    _s("Statistics", "Data/AI", "statistics|statistical analysis|hypothesis testing|probability"),
    _s("Linear Algebra", "Data/AI", "linear algebra"),
    _s("Data Visualization", "Data/AI", "data visualization|data visualisation"),
    _s("Power BI", "Data/AI", "power bi|powerbi"),
    _s("Tableau", "Data/AI", "tableau"),
    _s("Data Cleaning", "Data/AI", "data cleaning|data preprocessing|data wrangling|data cleansing|preprocessing"),
    _s("Data Modeling", "Data/AI", "data modeling|data modelling|feature engineering|predictive modeling"),
    _s("Model Evaluation", "Data/AI", "model evaluation|cross-validation|cross validation|confusion matrix|hyperparameter tuning"),
    _s("Excel", "Data/AI", "excel|ms excel|microsoft excel|spreadsheets|pivot tables|vlookup"),
    # Tools, cloud and DevOps
    _s("Git", "Tools", "git"),
    _s("GitHub", "Tools", "github|gitlab|bitbucket"),
    _s("Docker", "DevOps/Cloud", "docker|dockerfile|containerization"),
    _s("Kubernetes", "DevOps/Cloud", "kubernetes|k8s"),
    _s("AWS", "DevOps/Cloud", "aws|amazon web services|ec2"),
    _s("GCP", "DevOps/Cloud", "gcp|google cloud"),
    _s("Azure", "DevOps/Cloud", "azure|microsoft azure"),
    _s("Linux", "DevOps/Cloud", "linux|ubuntu|unix"),
    _s("Terraform", "DevOps/Cloud", "terraform"),
    _s("CI/CD", "DevOps/Cloud", "ci/cd|ci cd|cicd|github actions|jenkins|gitlab ci|continuous integration"),
    _s("Monitoring", "DevOps/Cloud", "monitoring|prometheus|grafana|cloudwatch|observability"),
    _s("Deployment", "DevOps/Cloud", "deployment|deployed|heroku|vercel|netlify"),
    _s("Testing", "Tools", "testing|unit testing|unit tests|jest|pytest|junit|selenium|test cases|tdd"),
    _s("Agile", "Tools", "agile|scrum"),
]

SKILLS_BY_NAME: Dict[str, Skill] = {s.name: s for s in SKILLS}


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------
def _alias_pattern(aliases: Tuple[str, ...]) -> Optional["re.Pattern[str]"]:
    if not aliases:
        return None
    alts = "|".join(re.escape(a) for a in sorted(aliases, key=len, reverse=True))
    # Not glued to other word characters, '+', '#' or a leading '.', so "javascript" is not "java" and "c++" is not "c"
    return re.compile(rf"(?<![\w+#.])(?:{alts})(?![\w+#])")


_COMPILED = {
    s.name: (
        _alias_pattern(s.aliases),
        _alias_pattern(s.ambiguous_aliases),
        [re.compile(c) for c in s.context],
    )
    for s in SKILLS
}


def scan(text: str, skills_context: bool = False) -> Dict[str, int]:
    """Skills mentioned in `text` (name -> mention count). Ambiguous aliases count only with skills_context=True."""
    lowered = text.lower()
    found: Dict[str, int] = {}
    for skill in SKILLS:
        normal, ambiguous, contexts = _COMPILED[skill.name]
        count = len(normal.findall(lowered)) if normal else 0
        count += sum(len(c.findall(lowered)) for c in contexts)
        if skills_context and ambiguous:
            count += len(ambiguous.findall(lowered))
        if count:
            found[skill.name] = count
    return found


def resolve_name(label: str) -> Optional[str]:
    """Canonical skill for an exact name or alias (ambiguous aliases allowed: the caller already knows the context)."""
    key = label.strip().lower()
    for skill in SKILLS:
        if key == skill.name.lower() or key in skill.aliases or key in skill.ambiguous_aliases:
            return skill.name
    return None


# ---------------------------------------------------------------------------
# Role requirements (labels exactly as written in career_config required_skills)
# ---------------------------------------------------------------------------
_DB = ("SQL", "MySQL", "PostgreSQL", "MongoDB", "SQLite", "DBMS")
_API = ("REST API", "FastAPI", "Flask", "Express.js", "Django", "Spring Boot", "GraphQL")
_FRAMEWORKS = ("FastAPI", "Django", "Flask", "Spring Boot", "Express.js", "Node.js", ".NET")

REQUIREMENT_MAP: Dict[str, Tuple[str, ...]] = {
    "HTML": ("HTML",),
    "CSS": ("CSS", "Tailwind CSS", "Bootstrap"),
    "JavaScript": ("JavaScript", "TypeScript"),
    "React": ("React", "Next.js"),
    "TypeScript": ("TypeScript",),
    "Git/GitHub": ("Git", "GitHub"),
    "Git": ("Git", "GitHub"),
    "REST API integration": _API,
    "REST APIs": _API,
    "REST concepts": _API,
    "APIs": _API,
    "Responsive Design": ("Responsive Design", "Tailwind CSS", "Bootstrap"),
    "Testing": ("Testing",),
    "Python/Java": ("Python", "Java"),
    "Python": ("Python",),
    "Python Basics": ("Python",),
    "Java Basics": ("Java",),
    "FastAPI or backend framework concepts": _FRAMEWORKS,
    "Databases": _DB,
    "MongoDB/Databases": _DB,
    "Authentication": ("Authentication",),
    "Data Structures": ("DSA",),
    "Deployment": ("Deployment", "Docker", "AWS", "CI/CD"),
    "Deployment basics": ("Deployment", "Docker", "AWS", "CI/CD"),
    "Backend Development": ("Backend Development",) + _FRAMEWORKS,
    "OOP": ("OOP",),
    "Functions": ("Functions",),
    "Collections": ("Collections",),
    "Exception Handling": ("Exception Handling",),
    "File Handling": ("File Handling",),
    "Multithreading": ("Multithreading",),
    "JDBC": ("JDBC",),
    "SQL": ("SQL", "MySQL", "PostgreSQL", "SQLite"),
    "Excel concepts": ("Excel",),
    "Statistics": ("Statistics",),
    "Pandas": ("Pandas",),
    "NumPy": ("NumPy",),
    "Data Visualization": ("Data Visualization", "Matplotlib", "Seaborn", "Power BI", "Tableau"),
    "Data Cleaning": ("Data Cleaning",),
    "Linear Algebra": ("Linear Algebra",),
    "Linear Algebra basics": ("Linear Algebra",),
    "Machine Learning": ("Machine Learning", "Scikit-learn", "TensorFlow", "PyTorch"),
    "Data Modeling": ("Data Modeling", "Machine Learning", "Scikit-learn"),
    "Model Evaluation": ("Model Evaluation",),
    "Deep Learning basics": ("Deep Learning", "TensorFlow", "PyTorch", "Keras"),
    "NLP basics": ("NLP",),
    "Linux OS": ("Linux",),
    "Docker": ("Docker",),
    "Kubernetes": ("Kubernetes",),
    "AWS / GCP": ("AWS", "GCP", "Azure"),
    "CI/CD (GitHub Actions)": ("CI/CD",),
    "Terraform": ("Terraform",),
    "Networking": ("Computer Networks",),
    "Monitoring": ("Monitoring",),
}

_QUALIFIERS = re.compile(r"\b(basics?|concepts?|integration|fundamentals)\b", re.I)


def requirement_alternatives(label: str) -> Tuple[str, ...]:
    """Catalog skills that satisfy one role requirement label. Empty tuple = no catalog skill (keyword match only)."""
    if label in REQUIREMENT_MAP:
        return REQUIREMENT_MAP[label]
    found: List[str] = []
    for part in re.split(r"\s*(?:/|,|\bor\b|\band\b)\s*", label):
        name = resolve_name(_QUALIFIERS.sub("", part).strip())
        if name and name not in found:
            found.append(name)
    return tuple(found)
