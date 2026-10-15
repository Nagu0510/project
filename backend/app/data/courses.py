"""Course catalog. Loaded into MongoDB by `python -m app.seed` (idempotent; documents with edited_by_admin are never touched).

Skills use the canonical names from data/skills.py (a test enforces it). Practice topics point at the coding-problem topics
and the question-bank topics the course should be paired with.

Resources are ONLY a provider name and the provider's official home page: no deep links are invented.
# verify link: every URL below is a provider home page chosen from memory. Open each one once before relying on it.
"""

LEVELS = ("Beginner", "Intermediate", "Advanced")


def _course(position, slug, title, level, description, skills, prerequisites, modules, outcomes, practice_topics,
            assessment_skills, resources):
    """modules: list of (title, [topics], hours)."""
    mods = [{"id": f"{slug}-m{i}", "title": t, "topics": topics, "hours": hours} for i, (t, topics, hours) in enumerate(modules, 1)]
    return {
        "slug": slug, "title": title, "level": level, "description": description, "position": position,
        "skills": skills, "prerequisites": prerequisites, "modules": mods,
        "estimated_hours": sum(m["hours"] for m in mods),
        "outcomes": outcomes, "practice_topics": practice_topics, "assessment_skills": assessment_skills,
        "resources": [{"provider": p, "url": u} for p, u in resources],
    }


# provider -> home page (verify link)
PYTHON_ORG = ("Python.org documentation", "https://www.python.org/")
NPTEL = ("NPTEL", "https://nptel.ac.in/")
FCC = ("freeCodeCamp", "https://www.freecodecamp.org/")
MDN = ("MDN Web Docs", "https://developer.mozilla.org/")
CPPREF = ("cppreference.com", "https://en.cppreference.com/")
ISOCPP = ("Standard C++ Foundation", "https://isocpp.org/")
DEV_JAVA = ("dev.java (Oracle)", "https://dev.java/")
KAGGLE = ("Kaggle Learn", "https://www.kaggle.com/")
GOOGLE_DEV = ("Google for Developers (Machine Learning Crash Course)", "https://developers.google.com/")
SKLEARN = ("scikit-learn documentation", "https://scikit-learn.org/")
PYTORCH = ("PyTorch", "https://pytorch.org/")
TENSORFLOW = ("TensorFlow", "https://www.tensorflow.org/")
NUMPY = ("NumPy documentation", "https://numpy.org/")
PANDAS = ("pandas documentation", "https://pandas.pydata.org/")
POSTGRES = ("PostgreSQL documentation", "https://www.postgresql.org/")
GIT = ("Git documentation", "https://git-scm.com/")
DOCKER = ("Docker documentation", "https://docs.docker.com/")
AWS = ("AWS", "https://aws.amazon.com/")
REACT = ("React documentation", "https://react.dev/")
KHAN = ("Khan Academy", "https://www.khanacademy.org/")

COURSES = [
    _course(
        1, "c-programming", "C Programming", "Beginner",
        "Learn C from the first program to pointers, memory and files: the language many placement tests still use.",
        ["C", "Functions", "File Handling"], [],
        [
            ("Getting started with C", ["Compiling and running", "Structure of a C program", "printf and scanf", "Comments and style"], 3),
            ("Data types and operators", ["int, float, char", "Type conversion", "Arithmetic, relational and logical operators", "Operator precedence"], 4),
            ("Control flow", ["if / else and switch", "for, while, do-while", "break and continue", "Pattern printing"], 5),
            ("Functions and recursion", ["Parameters and return values", "Scope and storage classes", "Recursion", "Stack frames"], 5),
            ("Arrays and strings", ["1D and 2D arrays", "String functions", "Character arrays and the null terminator", "Searching and sorting basics"], 6),
            ("Pointers", ["Address and dereference", "Pointer arithmetic", "Pointers and arrays", "Passing by reference"], 7),
            ("Dynamic memory", ["malloc, calloc, realloc, free", "Memory leaks", "Dangling pointers", "Linked list basics"], 6),
            ("Structures and files", ["struct and typedef", "Unions and enums", "File input and output", "Command line arguments"], 5),
        ],
        ["Write and debug C programs of a few hundred lines", "Explain how pointers and arrays relate", "Manage heap memory without leaks", "Read and write files in C"],
        ["Strings", "Arrays", "Recursion / DP", "C: Pointers"], ["C"],
        [("cppreference.com (C reference)", "https://en.cppreference.com/"), NPTEL, FCC],
    ),
    _course(
        2, "cpp-oop", "C++ and Object-Oriented Programming", "Intermediate",
        "Move from C to C++: classes, inheritance, polymorphism, templates and the standard library.",
        ["C++", "OOP", "Collections"], ["c-programming"],
        [
            ("From C to C++", ["References", "Namespaces", "Function overloading", "Default arguments"], 4),
            ("Classes and objects", ["Constructors and destructors", "Access specifiers", "this pointer", "Static members"], 6),
            ("Inheritance", ["Single and multiple inheritance", "Constructor order", "Diamond problem", "Protected access"], 5),
            ("Polymorphism", ["Virtual functions", "Abstract classes", "Vtable idea", "Overriding vs overloading"], 5),
            ("Operator overloading", ["Member vs friend operators", "Stream operators", "Copy and move semantics", "Rule of three and five"], 5),
            ("Templates", ["Function templates", "Class templates", "Template specialization basics", "Type deduction"], 5),
            ("The STL", ["vector, list, deque", "map, set, unordered_map", "Iterators", "Algorithms and lambdas"], 8),
            ("Memory and exceptions", ["Smart pointers", "RAII", "try, catch, throw", "Exception safety"], 6),
        ],
        ["Design small class hierarchies", "Use virtual functions correctly", "Pick the right STL container", "Manage resources with RAII"],
        ["Arrays", "Sorting", "Hashing", "C++: Classes & Objects"], ["C++"],
        [CPPREF, ISOCPP, NPTEL],
    ),
    _course(
        3, "python-programming", "Python Programming", "Beginner",
        "Python from variables to functions, collections, files, errors and object-oriented design.",
        ["Python", "Functions", "Collections", "Exception Handling", "File Handling", "OOP"], [],
        [
            ("Python basics", ["Variables and types", "Input and output", "Operators", "Strings and f-strings"], 3),
            ("Control flow", ["if / elif / else", "for and while loops", "range and enumerate", "Comprehensions"], 4),
            ("Functions", ["Parameters and defaults", "*args and **kwargs", "Scope and closures", "Lambda functions"], 5),
            ("Collections", ["Lists and tuples", "Dictionaries and sets", "Slicing", "Sorting with key functions"], 6),
            ("Errors and files", ["try, except, finally", "Raising exceptions", "Reading and writing files", "with statement"], 5),
            ("Object-oriented Python", ["Classes and instances", "Inheritance", "Dunder methods", "Dataclasses"], 6),
            ("Modules and tooling", ["Imports and packages", "Virtual environments", "pip", "Unit testing with pytest"], 4),
            ("Iterators and generators", ["Iterables", "yield", "Generator expressions", "Decorators"], 5),
        ],
        ["Write clean Python scripts", "Use lists, dicts and sets fluently", "Handle errors and files safely", "Build small classes and tests"],
        ["Strings", "Arrays", "Hashing", "Python Fundamentals"], ["Python"],
        [PYTHON_ORG, NPTEL, FCC],
    ),
    _course(
        4, "java-programming", "Java Programming", "Intermediate",
        "Core Java for placements: syntax, OOP, collections, exceptions, threads and database access.",
        ["Java", "OOP", "Collections", "Exception Handling", "Multithreading", "JDBC"], [],
        [
            ("Java fundamentals", ["JDK, JRE, JVM", "Data types and operators", "Control flow", "Arrays and Strings"], 5),
            ("Classes and objects", ["Constructors", "static and final", "Packages and access modifiers", "Immutability and String pool"], 6),
            ("Inheritance and polymorphism", ["extends and super", "Method overriding", "Abstract classes and interfaces", "Default methods"], 6),
            ("Exception handling", ["Checked vs unchecked", "try-with-resources", "Custom exceptions", "finally behaviour"], 4),
            ("Collections framework", ["List, Set, Map", "equals and hashCode", "Comparable and Comparator", "Iterators and fail-fast"], 7),
            ("Generics and lambdas", ["Generic classes and methods", "Wildcards", "Lambdas", "Streams basics"], 5),
            ("Multithreading", ["Thread and Runnable", "synchronized", "Executors", "Deadlock and volatile"], 6),
            ("JDBC", ["Connecting to a database", "PreparedStatement", "Transactions", "Mapping rows to objects"], 4),
        ],
        ["Explain the JVM and the String pool", "Use collections with correct equals and hashCode", "Write thread-safe code with synchronized or executors", "Query a database from Java"],
        ["Strings", "Arrays", "Hashing", "Java Fundamentals"], ["Java"],
        [DEV_JAVA, NPTEL, FCC],
    ),
    _course(
        5, "javascript-essentials", "JavaScript Essentials", "Beginner",
        "Modern JavaScript: types, functions, closures, the DOM, promises and async/await.",
        ["JavaScript", "Functions"], [],
        [
            ("Language basics", ["let, const, var", "Types and coercion", "Operators and equality", "Template literals"], 4),
            ("Control flow and functions", ["Loops and conditionals", "Function declarations and arrows", "Parameters and defaults", "Higher-order functions"], 5),
            ("Objects and arrays", ["Object literals", "Destructuring and spread", "map, filter, reduce", "JSON"], 5),
            ("Scope and closures", ["Lexical scope", "Closures", "Hoisting and the temporal dead zone", "this and binding"], 5),
            ("Prototypes and classes", ["Prototype chain", "class syntax", "Inheritance", "Getters and setters"], 4),
            ("Asynchronous JavaScript", ["Callbacks", "Promises", "async and await", "The event loop"], 6),
            ("The DOM", ["Selecting and changing elements", "Events and delegation", "Forms", "Web storage"], 5),
            ("Modules and tooling", ["ES modules", "npm basics", "Error handling", "Testing a function"], 4),
        ],
        ["Predict the output of closure and event-loop puzzles", "Write async code without callback pile-ups", "Manipulate the DOM", "Use array methods fluently"],
        ["Strings", "Arrays", "Hashing", "JavaScript Core"], ["JavaScript"],
        [MDN, FCC, NPTEL],
    ),
    _course(
        6, "dsa", "Data Structures and Algorithms", "Intermediate",
        "The core data structures and algorithm patterns that placement coding rounds are built on.",
        ["DSA"], ["python-programming"],
        [
            ("Complexity analysis", ["Big O", "Best, average, worst case", "Space complexity", "Amortized cost"], 3),
            ("Arrays and strings", ["Two pointers", "Sliding window", "Prefix sums", "In-place techniques"], 7),
            ("Hashing", ["Hash maps and sets", "Counting and grouping", "Collisions", "Two-sum style problems"], 5),
            ("Linked lists, stacks and queues", ["Singly and doubly linked lists", "Stack applications", "Queue and deque", "Monotonic stack"], 7),
            ("Sorting and searching", ["Bubble, insertion, merge, quick sort", "Binary search", "Search on the answer", "Stability"], 7),
            ("Recursion and backtracking", ["Recursion tree", "Subsets and permutations", "Pruning", "Memoization"], 6),
            ("Trees and graphs", ["Binary trees and BST", "DFS and BFS", "Shortest paths basics", "Union-find"], 9),
            ("Dynamic programming", ["Overlapping subproblems", "1D and 2D DP", "Knapsack and coin change", "Longest subsequences"], 9),
        ],
        ["Choose the right data structure for a problem", "Solve medium coding-round problems", "Analyse time and space complexity", "Write recursive and DP solutions"],
        ["Arrays", "Two Pointers", "Hashing", "Stack", "Sorting", "Recursion / DP"], ["DSA"],
        [NPTEL, FCC, KHAN],
    ),
    _course(
        7, "sql-dbms", "SQL and DBMS", "Beginner",
        "Relational thinking and SQL: queries, joins, design, transactions and indexing.",
        ["SQL", "DBMS", "MySQL", "PostgreSQL", "SQLite"], [],
        [
            ("Relational model", ["Tables, rows and keys", "ER diagrams", "Relational algebra basics", "Constraints"], 4),
            ("SQL basics", ["SELECT, WHERE, ORDER BY", "Aggregate functions", "GROUP BY and HAVING", "NULL handling"], 5),
            ("Joins and subqueries", ["Inner, left, right, full joins", "Self joins", "Subqueries", "UNION and set operations"], 6),
            ("Data definition and changes", ["CREATE, ALTER, DROP", "INSERT, UPDATE, DELETE", "Views", "Foreign keys"], 4),
            ("Normalization", ["Functional dependencies", "1NF, 2NF, 3NF, BCNF", "Denormalization", "Design exercises"], 5),
            ("Transactions", ["ACID", "Isolation levels", "Locks and deadlocks", "Commit and rollback"], 5),
            ("Indexing and performance", ["B-tree indexes", "Reading query plans", "Covering indexes", "Common slow-query causes"], 4),
            ("Advanced SQL", ["Window functions", "CTEs", "Ranking and running totals", "Stored procedures overview"], 5),
        ],
        ["Write multi-table queries", "Design a normalized schema", "Explain ACID and isolation levels", "Read a basic query plan"],
        ["SQL Fundamentals", "SQL Queries", "Hashing"], ["SQL & Databases"],
        [POSTGRES, NPTEL, KHAN],
    ),
    _course(
        8, "web-development", "Web Development (HTML, CSS, React)", "Beginner",
        "Build responsive pages with HTML and CSS, then interactive apps with React that call REST APIs.",
        ["HTML", "CSS", "React", "Responsive Design", "REST API"], [],
        [
            ("HTML foundations", ["Semantic elements", "Forms and validation", "Accessibility basics", "Media"], 4),
            ("CSS foundations", ["Selectors and the cascade", "Box model", "Flexbox", "Grid"], 6),
            ("Responsive design", ["Media queries", "Mobile-first layouts", "Fluid type and spacing", "Images that adapt"], 4),
            ("JavaScript for the web", ["Events", "Fetching data", "Working with JSON", "Browser storage"], 5),
            ("React basics", ["Components and props", "JSX", "State with useState", "Lists and keys"], 6),
            ("React in depth", ["useEffect", "Custom hooks", "Context", "Routing"], 7),
            ("Talking to an API", ["REST concepts", "Loading and error states", "Auth headers", "Forms that submit"], 5),
            ("Ship it", ["Build and deploy", "Performance basics", "Testing a component", "Portfolio checklist"], 4),
        ],
        ["Build a responsive multi-page site", "Create a React app with state and routing", "Consume a REST API with loading and error states", "Deploy a small web app"],
        ["Strings", "Arrays", "React Hooks", "React State"], ["React", "JavaScript"],
        [MDN, REACT, FCC],
    ),
    _course(
        9, "machine-learning", "Machine Learning", "Intermediate",
        "Supervised and unsupervised learning, evaluation and the practical workflow with scikit-learn.",
        ["Machine Learning", "Scikit-learn", "Statistics", "Model Evaluation", "Linear Algebra", "Data Modeling"], ["python-programming"],
        [
            ("Math you need", ["Vectors and matrices", "Probability basics", "Descriptive statistics", "Gradients intuition"], 6),
            ("The ML workflow", ["Problem framing", "Train, validation and test splits", "Features and labels", "Baselines"], 4),
            ("Linear and logistic regression", ["Least squares", "Regularization", "Sigmoid and decision boundary", "Interpreting coefficients"], 7),
            ("Trees and ensembles", ["Decision trees", "Random forests", "Gradient boosting", "Feature importance"], 6),
            ("Other classic models", ["k-nearest neighbours", "Naive Bayes", "SVM overview", "Choosing a model"], 5),
            ("Evaluation", ["Accuracy, precision, recall, F1", "Confusion matrix", "ROC and AUC", "Cross-validation"], 5),
            ("Unsupervised learning", ["k-means", "Hierarchical clustering", "PCA", "Anomaly detection basics"], 5),
            ("Overfitting and tuning", ["Bias and variance", "Hyperparameter search", "Data leakage", "Pipelines"], 5),
            ("A complete project", ["Clean and explore data", "Train and compare models", "Write up results", "Save and reuse a model"], 7),
        ],
        ["Frame a problem as supervised or unsupervised", "Train and evaluate models with scikit-learn", "Spot overfitting and data leakage", "Explain a model's results"],
        ["Arrays", "Machine Learning"], ["Machine Learning", "AI / Machine Learning"],
        [GOOGLE_DEV, SKLEARN, KAGGLE],
    ),
    _course(
        10, "deep-learning-ai", "Deep Learning and AI", "Advanced",
        "Neural networks, NLP, computer vision and the basics of generative AI.",
        ["Deep Learning", "NLP", "Computer Vision", "Generative AI", "TensorFlow", "PyTorch", "Keras", "OpenCV"], ["machine-learning"],
        [
            ("Neural network basics", ["Neurons and layers", "Activation functions", "Loss functions", "Forward pass"], 5),
            ("Training networks", ["Backpropagation", "Gradient descent variants", "Learning rate", "Batch size and epochs"], 6),
            ("Regularization and tricks", ["Dropout", "Batch normalization", "Early stopping", "Data augmentation"], 4),
            ("Frameworks", ["Tensors", "Building a model in PyTorch", "Keras and TensorFlow basics", "Saving and loading models"], 6),
            ("Computer vision", ["Convolutions and pooling", "CNN architectures", "Transfer learning", "OpenCV basics"], 7),
            ("NLP", ["Tokenization", "Embeddings", "Recurrent networks", "Attention and transformers"], 7),
            ("Generative AI basics", ["Language model idea", "Prompting", "Retrieval-augmented generation overview", "Limits and safety"], 5),
            ("Deploying AI", ["Model serving basics", "Latency and cost", "Monitoring drift", "Responsible use"], 4),
        ],
        ["Explain how a neural network learns", "Train a small CNN or text classifier", "Use transfer learning", "Describe what generative models can and cannot do"],
        ["Machine Learning", "Deep Learning & AI"], ["Deep Learning & AI", "AI / Machine Learning"],
        [PYTORCH, TENSORFLOW, KAGGLE],
    ),
    _course(
        11, "data-science-python", "Data Science with Python (NumPy, Pandas)", "Intermediate",
        "Load, clean, analyse and visualise data with NumPy, Pandas and Matplotlib.",
        ["NumPy", "Pandas", "Matplotlib", "Seaborn", "Data Cleaning", "Data Visualization", "Excel", "Statistics"], ["python-programming"],
        [
            ("NumPy arrays", ["ndarray", "Indexing and slicing", "Broadcasting", "Vectorized operations"], 5),
            ("Pandas basics", ["Series and DataFrame", "Reading CSV and Excel", "Selecting rows and columns", "Sorting and filtering"], 5),
            ("Data cleaning", ["Missing values", "Duplicates", "Type fixes", "String cleaning"], 6),
            ("Transforming data", ["groupby", "merge and join", "pivot tables", "apply and map"], 6),
            ("Statistics for analysis", ["Mean, median, variance", "Distributions", "Correlation", "Hypothesis test overview"], 5),
            ("Visualization", ["Matplotlib basics", "Seaborn plots", "Choosing a chart", "Dashboards overview"], 5),
            ("Spreadsheets and SQL", ["Excel pivot tables", "VLOOKUP and lookups", "Pandas vs SQL", "Reporting"], 4),
            ("End-to-end analysis", ["Ask a question", "Clean and explore", "Plot and explain", "Present findings"], 6),
        ],
        ["Clean a messy dataset", "Summarise data with groupby and pivots", "Make clear charts", "Present findings from data"],
        ["Arrays", "Hashing"], ["Python", "AI / Machine Learning"],
        [NUMPY, PANDAS, KAGGLE],
    ),
    _course(
        12, "git-docker-cloud", "Git, Docker and Cloud Basics", "Beginner",
        "The tools every developer is expected to know: version control, containers, Linux and a first look at the cloud.",
        ["Git", "GitHub", "Docker", "Linux", "AWS", "CI/CD", "Deployment", "Monitoring"], [],
        [
            ("Git basics", ["init, add, commit", "Branches and merging", "Resolving conflicts", "Undoing changes"], 4),
            ("Working with GitHub", ["Remotes", "Pull requests", "Code review habits", "Forks"], 3),
            ("Linux command line", ["Files and permissions", "Processes", "Pipes and redirection", "Shell scripts"], 5),
            ("Docker basics", ["Images and containers", "Dockerfile", "Volumes and ports", "Docker Compose"], 6),
            ("Cloud concepts", ["IaaS, PaaS, SaaS", "Regions and availability", "Compute, storage, networking", "Cost awareness"], 4),
            ("AWS first steps", ["IAM basics", "EC2 and S3", "Security groups", "Free-tier safety"], 5),
            ("CI/CD", ["Pipelines", "GitHub Actions", "Automated tests and builds", "Deploy on merge"], 4),
            ("Deploy and watch", ["Environment variables", "Logs", "Basic monitoring", "Rollbacks"], 4),
        ],
        ["Use Git branches and pull requests confidently", "Containerize a small app", "Navigate a Linux server", "Set up a simple CI pipeline"],
        ["Cloud / DevOps"], ["Cloud / DevOps"],
        [GIT, DOCKER, AWS],
    ),
    _course(
        13, "placement-aptitude", "Placement Aptitude", "Beginner",
        "Quantitative, logical and verbal reasoning practice for the first screening round.",
        [], [],
        [
            ("Number system and percentages", ["Divisibility", "Percentages", "Profit and loss", "Ratio and proportion"], 5),
            ("Time, speed and work", ["Time and distance", "Trains and boats", "Work and wages", "Pipes and cisterns"], 5),
            ("Averages and mixtures", ["Averages", "Weighted averages", "Alligation", "Ages"], 4),
            ("Permutations and probability", ["Counting principle", "Permutations and combinations", "Basic probability", "Dice and cards"], 5),
            ("Logical reasoning", ["Series and patterns", "Coding-decoding", "Blood relations", "Seating arrangements"], 6),
            ("Data interpretation", ["Tables", "Bar and line charts", "Pie charts", "Caselets"], 5),
            ("Verbal ability", ["Grammar and error spotting", "Synonyms and antonyms", "Reading comprehension", "Sentence completion"], 5),
            ("Test strategy", ["Time per question", "Elimination", "Mock test routine", "Reviewing mistakes"], 3),
        ],
        ["Solve common aptitude question types quickly", "Read charts and tables accurately", "Manage time in a timed test"],
        ["Math"], [],
        [KHAN, NPTEL, FCC],
    ),
]

COURSES_BY_SLUG = {c["slug"]: c for c in COURSES}
