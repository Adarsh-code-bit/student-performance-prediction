"""
=============================================================================
STUDENT PULSE — Database Access Layer (MySQL with SQLite fallback)
File: db.py
Provides secure, parameterized CRUD operations for registered students.
=============================================================================
"""

import os
import sqlite3
import pymysql
from pymysql.cursors import DictCursor

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", 3306))
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "1234")
DB_NAME = os.environ.get("DB_NAME", "student_pulse")

# SQLite fallback path if MySQL server is unreachable
SQLITE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "students_registered.db")


def is_mysql_available():
    """Checks if MySQL can be reached with configured credentials."""
    try:
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=2
        )
        conn.close()
        return True
    except Exception:
        return False


def get_mysql_connection():
    """Returns an active MySQL connection to DB_NAME."""
    # Ensure database exists
    root_conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        connect_timeout=3
    )
    with root_conn.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    root_conn.commit()
    root_conn.close()

    conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=DictCursor,
        autocommit=True
    )
    return conn


def init_db():
    """Initializes table schema in MySQL or SQLite."""
    if is_mysql_available():
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS students (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        usn VARCHAR(50) NOT NULL UNIQUE,
                        name VARCHAR(100) NOT NULL,
                        email VARCHAR(100) NULL,
                        phone VARCHAR(20) NULL,
                        department VARCHAR(50) NULL DEFAULT 'Computer Science',
                        semester VARCHAR(20) NULL DEFAULT 'Semester 5',
                        section VARCHAR(10) NULL DEFAULT 'A',
                        cgpa DECIMAL(4, 2) NOT NULL,
                        internal_marks DECIMAL(5, 2) NOT NULL,
                        attendance DECIMAL(5, 2) NOT NULL,
                        assignment_marks DECIMAL(4, 2) NOT NULL,
                        academic_status VARCHAR(50) NULL,
                        exam_eligibility VARCHAR(50) NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB;
                """)
        finally:
            conn.close()
    else:
        # SQLite Fallback
        os.makedirs(os.path.dirname(SQLITE_PATH), exist_ok=True)
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usn TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                department TEXT DEFAULT 'Computer Science',
                semester TEXT DEFAULT 'Semester 5',
                section TEXT DEFAULT 'A',
                cgpa REAL NOT NULL,
                internal_marks REAL NOT NULL,
                attendance REAL NOT NULL,
                assignment_marks REAL NOT NULL,
                academic_status TEXT,
                exam_eligibility TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        conn.close()


def get_all_students(search=None, usn=None, semester=None, section=None, status=None, eligibility=None):
    """Retrieves students matching search and filter conditions."""
    init_db()
    use_mysql = is_mysql_available()

    if use_mysql:
        conn = get_mysql_connection()
        try:
            query = "SELECT * FROM students WHERE 1=1"
            params = []

            if search:
                query += " AND (LOWER(name) LIKE %s OR LOWER(usn) LIKE %s)"
                params.extend([f"%{search.lower()}%", f"%{search.lower()}%"])
            if usn:
                query += " AND LOWER(usn) LIKE %s"
                params.append(f"%{usn.lower()}%")
            if semester and semester != "ALL":
                query += " AND semester = %s"
                params.append(semester)
            if section and section != "ALL":
                query += " AND section = %s"
                params.append(section)
            if status and status != "ALL":
                query += " AND academic_status = %s"
                params.append(status)
            if eligibility and eligibility != "ALL":
                query += " AND exam_eligibility = %s"
                params.append(eligibility)

            query += " ORDER BY id DESC"

            with conn.cursor() as cur:
                cur.execute(query, params)
                rows = cur.fetchall()
                # Format numeric types
                for r in rows:
                    r["cgpa"] = float(r["cgpa"])
                    r["internal_marks"] = float(r["internal_marks"])
                    r["attendance"] = float(r["attendance"])
                    r["assignment_marks"] = float(r["assignment_marks"])
                return rows
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        query = "SELECT * FROM students WHERE 1=1"
        params = []

        if search:
            query += " AND (LOWER(name) LIKE ? OR LOWER(usn) LIKE ?)"
            params.extend([f"%{search.lower()}%", f"%{search.lower()}%"])
        if usn:
            query += " AND LOWER(usn) LIKE ?"
            params.append(f"%{usn.lower()}%")
        if semester and semester != "ALL":
            query += " AND semester = ?"
            params.append(semester)
        if section and section != "ALL":
            query += " AND section = ?"
            params.append(section)
        if status and status != "ALL":
            query += " AND academic_status = ?"
            params.append(status)
        if eligibility and eligibility != "ALL":
            query += " AND exam_eligibility = ?"
            params.append(eligibility)

        query += " ORDER BY id DESC"
        cur.execute(query, params)
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows


def get_student_by_id(student_id):
    """Retrieves a single student by numeric ID."""
    init_db()
    use_mysql = is_mysql_available()

    if use_mysql:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM students WHERE id = %s", (student_id,))
                r = cur.fetchone()
                if r:
                    r["cgpa"] = float(r["cgpa"])
                    r["internal_marks"] = float(r["internal_marks"])
                    r["attendance"] = float(r["attendance"])
                    r["assignment_marks"] = float(r["assignment_marks"])
                return r
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM students WHERE id = ?", (student_id,))
        r = cur.fetchone()
        conn.close()
        return dict(r) if r else None


def get_student_by_usn(usn):
    """Retrieves a single student by USN."""
    init_db()
    use_mysql = is_mysql_available()

    if use_mysql:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM students WHERE LOWER(usn) = %s", (usn.strip().lower(),))
                r = cur.fetchone()
                if r:
                    r["cgpa"] = float(r["cgpa"])
                    r["internal_marks"] = float(r["internal_marks"])
                    r["attendance"] = float(r["attendance"])
                    r["assignment_marks"] = float(r["assignment_marks"])
                return r
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM students WHERE LOWER(usn) = ?", (usn.strip().lower(),))
        r = cur.fetchone()
        conn.close()
        return dict(r) if r else None


def add_student(data):
    """Adds a new student to the database with parameterized queries."""
    init_db()
    use_mysql = is_mysql_available()

    usn = data.get("usn", "").strip().upper()
    name = data.get("name", "").strip()
    email = data.get("email", "").strip() or None
    phone = data.get("phone", "").strip() or None
    department = data.get("department", "Computer Science").strip()
    semester = data.get("semester", "Semester 5").strip()
    section = data.get("section", "A").strip()
    cgpa = float(data.get("cgpa", 0.0))
    internal = float(data.get("internal_marks", 0.0))
    attendance = float(data.get("attendance", 0.0))
    assignment = float(data.get("assignment_marks", 0.0))
    status = data.get("academic_status", "On Track")
    eligibility = "Eligible" if attendance >= 75.0 else "Not Eligible"

    if use_mysql:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO students (
                        usn, name, email, phone, department, semester, section,
                        cgpa, internal_marks, attendance, assignment_marks,
                        academic_status, exam_eligibility
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    usn, name, email, phone, department, semester, section,
                    cgpa, internal, attendance, assignment, status, eligibility
                ))
                new_id = cur.lastrowid
                return get_student_by_id(new_id)
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO students (
                usn, name, email, phone, department, semester, section,
                cgpa, internal_marks, attendance, assignment_marks,
                academic_status, exam_eligibility
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            usn, name, email, phone, department, semester, section,
            cgpa, internal, attendance, assignment, status, eligibility
        ))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return get_student_by_id(new_id)


def update_student(student_id, data):
    """Updates an existing student with parameterized queries."""
    init_db()
    use_mysql = is_mysql_available()

    name = data.get("name", "").strip()
    email = data.get("email", "").strip() or None
    phone = data.get("phone", "").strip() or None
    department = data.get("department", "Computer Science").strip()
    semester = data.get("semester", "Semester 5").strip()
    section = data.get("section", "A").strip()
    cgpa = float(data.get("cgpa", 0.0))
    internal = float(data.get("internal_marks", 0.0))
    attendance = float(data.get("attendance", 0.0))
    assignment = float(data.get("assignment_marks", 0.0))
    status = data.get("academic_status", "On Track")
    eligibility = "Eligible" if attendance >= 75.0 else "Not Eligible"

    if use_mysql:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE students SET
                        name = %s, email = %s, phone = %s, department = %s,
                        semester = %s, section = %s, cgpa = %s,
                        internal_marks = %s, attendance = %s,
                        assignment_marks = %s, academic_status = %s,
                        exam_eligibility = %s
                    WHERE id = %s
                """, (
                    name, email, phone, department, semester, section,
                    cgpa, internal, attendance, assignment, status,
                    eligibility, student_id
                ))
                return get_student_by_id(student_id)
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("""
            UPDATE students SET
                name = ?, email = ?, phone = ?, department = ?,
                semester = ?, section = ?, cgpa = ?,
                internal_marks = ?, attendance = ?,
                assignment_marks = ?, academic_status = ?,
                exam_eligibility = ?
            WHERE id = ?
        """, (
            name, email, phone, department, semester, section,
            cgpa, internal, attendance, assignment, status,
            eligibility, student_id
        ))
        conn.commit()
        conn.close()
        return get_student_by_id(student_id)


def delete_student(student_id):
    """Deletes a student record by ID."""
    init_db()
    use_mysql = is_mysql_available()

    if use_mysql:
        conn = get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM students WHERE id = %s", (student_id,))
                return cur.rowcount > 0
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM students WHERE id = ?", (student_id,))
        conn.commit()
        deleted = cur.rowcount > 0
        conn.close()
        return deleted


def get_student_stats():
    """Calculates statistics from actual registered students."""
    students = get_all_students()
    total = len(students)
    on_track = sum(1 for s in students if s.get("academic_status") == "On Track")
    needs_attention = sum(1 for s in students if s.get("academic_status") == "Needs Attention")
    at_risk = sum(1 for s in students if s.get("academic_status") == "At Risk")
    eligible = sum(1 for s in students if s.get("exam_eligibility") == "Eligible")
    not_eligible = total - eligible

    return {
        "total": total,
        "on_track": on_track,
        "needs_attention": needs_attention,
        "at_risk": at_risk,
        "eligible": eligible,
        "not_eligible": not_eligible
    }

