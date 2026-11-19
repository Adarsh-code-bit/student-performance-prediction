"""
=============================================================================
The Drop – Student Academic Performance Monitoring System
File: app.py
Framework: Flask
=============================================================================
Run with:
  python app.py
Open at:
  http://localhost:5000
=============================================================================
"""

import os
import socket
from flask import Flask, render_template, request, jsonify
import model
import db

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.jinja_env.auto_reload = True

@app.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Preload model and dataset on startup
bundle = model.get_model_bundle()


def get_free_port(preferred_port=5000):
    """Finds an available local port starting with preferred_port."""
    for p in [preferred_port, 5001, 5050, 8000, 8080]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    return preferred_port


@app.route("/")
def index():
    """Serves the single-page application."""
    return render_template("index.html")


@app.route("/api/tree", methods=["GET"])
def api_tree():
    """
    Returns the real trained Decision Tree structure directly from clf.tree_.
    Includes node ids, features, thresholds, child ids, sample counts, and leaves.
    """
    try:
        tree_data = model.get_tree_json()
        return jsonify(tree_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/predict", methods=["POST"])
def api_predict():
    """
    Predicts academic standing for 4 input features:
      - cgpa (0.0 - 10.0)
      - internal_marks (0.0 - 40.0)
      - attendance (0.0 - 100.0)
      - assignment_marks (0.0 - 10.0)
    Returns predicted category, ordered path of node IDs, and exam eligibility.
    """
    try:
        data = request.get_json(force=True)
        cgpa = float(data.get("cgpa", 7.0))
        internal_marks = float(data.get("internal_marks", 25.0))
        attendance = float(data.get("attendance", 75.0))
        assignment_marks = float(data.get("assignment_marks", 7.0))

        # Clamp inputs to allowable bounds
        cgpa = max(0.0, min(10.0, cgpa))
        internal_marks = max(0.0, min(40.0, internal_marks))
        attendance = max(0.0, min(100.0, attendance))
        assignment_marks = max(0.0, min(10.0, assignment_marks))

        result = model.predict_student(
            cgpa=cgpa,
            internal_marks=internal_marks,
            attendance=attendance,
            assignment_marks=assignment_marks
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/cohort", methods=["GET"])
def api_cohort():
    """
    Returns the full cohort of 200 synthetic students with:
      - student_id, cgpa, internal_marks, attendance, assignment_marks
      - category, leaf_id, gate, eligibility
    Used for 'Drop all 200' cascade and the Departures flight table.
    """
    try:
        b = model.get_model_bundle()
        df = b["df"].copy()
        
        students = df.to_dict(orient="records")
        for s in students:
            s["eligible"] = bool(s["eligible"])
            s["leaf_id"] = int(s["leaf_id"])
            s["cgpa"] = float(s["cgpa"])
            s["internal_marks"] = float(s["internal_marks"])
            s["attendance"] = float(s["attendance"])
            s["assignment_marks"] = float(s["assignment_marks"])

        counts = df["category"].value_counts().to_dict()
        low_att_count = int((df["attendance"] < 75.0).sum())

        return jsonify({
            "total": len(students),
            "counts": counts,
            "low_attendance_count": low_att_count,
            "average_attendance": round(float(df["attendance"].mean()), 2),
            "average_cgpa": round(float(df["cgpa"].mean()), 2),
            "students": students
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/model", methods=["GET"])
def api_model():
    """
    Returns tree hyperparameters, evaluation metrics (Accuracy, Confusion Matrix),
    and feature importances.
    """
    try:
        b = model.get_model_bundle()
        df = b["df"]
        return jsonify({
            "model_type": "DecisionTreeClassifier",
            "criterion": "gini",
            "max_depth": 4,
            "min_samples_split": 5,
            "min_samples_leaf": 2,
            "random_state": 42,
            "train_accuracy": b["train_accuracy"],
            "test_accuracy": b["test_accuracy"],
            "feature_importances": b["feature_importances"],
            "confusion_matrix": b["confusion_matrix"],
            "cohort_summary": {
                "total_students": len(df),
                "on_track": int((df["category"] == "On Track").sum()),
                "needs_attention": int((df["category"] == "Needs Attention").sum()),
                "at_risk": int((df["category"] == "At Risk").sum()),
                "avg_attendance": round(float(df["attendance"].mean()), 2),
                "avg_cgpa": round(float(df["cgpa"].mean()), 2),
                "below_75_attendance": int((df["attendance"] < 75.0).sum())
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================================================
# Registered Students API Endpoints (MySQL with Parameterized Queries)
# =============================================================================

@app.route("/api/students", methods=["GET"])
def api_get_students():
    """
    Returns registered students from MySQL with optional search & filter parameters.
    """
    try:
        search = request.args.get("search", "").strip() or None
        usn = request.args.get("usn", "").strip() or None
        semester = request.args.get("semester", "").strip() or None
        section = request.args.get("section", "").strip() or None
        status = request.args.get("status", "").strip() or None
        eligibility = request.args.get("eligibility", "").strip() or None

        students = db.get_all_students(
            search=search,
            usn=usn,
            semester=semester,
            section=section,
            status=status,
            eligibility=eligibility
        )
        stats = db.get_student_stats()
        return jsonify({
            "success": True,
            "total": len(students),
            "stats": stats,
            "students": students
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/students/<int:student_id>", methods=["GET"])
def api_get_student(student_id):
    """
    Returns a single registered student by numeric ID.
    """
    try:
        student = db.get_student_by_id(student_id)
        if not student:
            return jsonify({"success": False, "error": f"Student with ID {student_id} not found"}), 404
        return jsonify({"success": True, "student": student})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/students", methods=["POST"])
def api_create_student():
    """
    Registers a new student, validates required fields and numeric ranges,
    predicts academic category using the Decision Tree model, and persists to MySQL.
    """
    try:
        data = request.get_json(force=True)
        usn = data.get("usn", "").strip().upper()
        name = data.get("name", "").strip()

        if not usn:
            return jsonify({"success": False, "error": "USN is required"}), 400
        if not name:
            return jsonify({"success": False, "error": "Student Name is required"}), 400

        # Check USN uniqueness
        existing = db.get_student_by_usn(usn)
        if existing:
            return jsonify({"success": False, "error": f"Student with USN '{usn}' already exists"}), 409

        # Validate numeric ranges
        try:
            cgpa = float(data.get("cgpa", 0.0))
            internal = float(data.get("internal_marks", 0.0))
            attendance = float(data.get("attendance", 0.0))
            assignment = float(data.get("assignment_marks", 0.0))
        except (ValueError, TypeError):
            return jsonify({"success": False, "error": "Academic marks and attendance must be valid numbers"}), 400

        if not (0.0 <= cgpa <= 10.0):
            return jsonify({"success": False, "error": "CGPA must be between 0.0 and 10.0"}), 400
        if not (0.0 <= internal <= 40.0):
            return jsonify({"success": False, "error": "Internal marks must be between 0 and 40"}), 400
        if not (0.0 <= attendance <= 100.0):
            return jsonify({"success": False, "error": "Attendance must be between 0% and 100%"}), 400
        if not (0.0 <= assignment <= 10.0):
            return jsonify({"success": False, "error": "Assignment marks must be between 0.0 and 10.0"}), 400

        # Predict academic category using real Decision Tree
        pred_res = model.predict_student(cgpa, internal, attendance, assignment)
        academic_status = pred_res["predicted_category"]
        exam_eligibility = "Eligible" if attendance >= 75.0 else "Not Eligible"

        student_data = {
            "usn": usn,
            "name": name,
            "email": data.get("email", "").strip() or None,
            "phone": data.get("phone", "").strip() or None,
            "department": data.get("department", "Computer Science").strip(),
            "semester": data.get("semester", "Semester 5").strip(),
            "section": data.get("section", "A").strip(),
            "cgpa": cgpa,
            "internal_marks": internal,
            "attendance": attendance,
            "assignment_marks": assignment,
            "academic_status": academic_status,
            "exam_eligibility": exam_eligibility
        }

        created = db.add_student(student_data)
        return jsonify({
            "success": True,
            "message": f"Student {usn} ({name}) added successfully",
            "student": created
        }), 201

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/students/<int:student_id>", methods=["PUT"])
def api_update_student(student_id):
    """
    Updates an existing student, recalculates ML prediction, and saves to MySQL.
    """
    try:
        existing = db.get_student_by_id(student_id)
        if not existing:
            return jsonify({"success": False, "error": f"Student with ID {student_id} not found"}), 404

        data = request.get_json(force=True)
        name = data.get("name", "").strip()
        if not name:
            return jsonify({"success": False, "error": "Student Name is required"}), 400

        # Validate numeric ranges
        try:
            cgpa = float(data.get("cgpa", existing["cgpa"]))
            internal = float(data.get("internal_marks", existing["internal_marks"]))
            attendance = float(data.get("attendance", existing["attendance"]))
            assignment = float(data.get("assignment_marks", existing["assignment_marks"]))
        except (ValueError, TypeError):
            return jsonify({"success": False, "error": "Academic marks and attendance must be valid numbers"}), 400

        if not (0.0 <= cgpa <= 10.0):
            return jsonify({"success": False, "error": "CGPA must be between 0.0 and 10.0"}), 400
        if not (0.0 <= internal <= 40.0):
            return jsonify({"success": False, "error": "Internal marks must be between 0 and 40"}), 400
        if not (0.0 <= attendance <= 100.0):
            return jsonify({"success": False, "error": "Attendance must be between 0% and 100%"}), 400
        if not (0.0 <= assignment <= 10.0):
            return jsonify({"success": False, "error": "Assignment marks must be between 0.0 and 10.0"}), 400

        # Recalculate prediction
        pred_res = model.predict_student(cgpa, internal, attendance, assignment)
        academic_status = pred_res["predicted_category"]
        exam_eligibility = "Eligible" if attendance >= 75.0 else "Not Eligible"

        update_payload = {
            "name": name,
            "email": data.get("email", existing.get("email")),
            "phone": data.get("phone", existing.get("phone")),
            "department": data.get("department", existing.get("department")),
            "semester": data.get("semester", existing.get("semester")),
            "section": data.get("section", existing.get("section")),
            "cgpa": cgpa,
            "internal_marks": internal,
            "attendance": attendance,
            "assignment_marks": assignment,
            "academic_status": academic_status,
            "exam_eligibility": exam_eligibility
        }

        updated = db.update_student(student_id, update_payload)
        return jsonify({
            "success": True,
            "message": f"Student {existing['usn']} updated successfully",
            "student": updated
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/students/<int:student_id>", methods=["DELETE"])
def api_delete_student(student_id):
    """
    Deletes a registered student record from MySQL.
    """
    try:
        existing = db.get_student_by_id(student_id)
        if not existing:
            return jsonify({"success": False, "error": f"Student with ID {student_id} not found"}), 404

        deleted = db.delete_student(student_id)
        if deleted:
            return jsonify({
                "success": True,
                "message": f"Student {existing['usn']} ({existing['name']}) deleted successfully"
            }), 200
        return jsonify({"success": False, "error": "Failed to delete student record"}), 500

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    env_port = os.environ.get("PORT")
    if env_port:
        port = int(env_port)
    else:
        port = get_free_port(5000)
    
    print("=" * 60)
    print(f"🎯 STUDENT PULSE is running at: http://localhost:{port}")
    if port != 5000:
        print(f"   (Port 5000 was in use by another process; automatically switched to {port})")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=False)
