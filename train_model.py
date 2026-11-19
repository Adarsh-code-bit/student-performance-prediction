"""
=============================================================================
Student Academic Performance Monitoring and Prediction System
File: train_model.py
Purpose: 
  1. Generate a synthetic dataset (student_data.csv) of 200 student records
     using the updated college marks evaluation structure:
       - Attendance Percentage: 0 - 100%
       - Internal Examination Marks: 0 - 40 marks
       - Assignment Marks: 0 - 10 marks
       - Previous Semester CGPA: 0.0 - 10.0
  2. Implement updated composite score formula and classification rules.
  3. Train a beginner-friendly Decision Tree Classifier.
  4. Evaluate model performance (Accuracy, Confusion Matrix, Classification Report).
  5. Save the trained model to 'model.pkl' for use in the Streamlit application.
=============================================================================
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# Set random seed for reproducibility
np.random.seed(42)

def generate_synthetic_data(num_samples=200, filepath="student_data.csv"):
    """
    Generates synthetic academic data according to college evaluation structure:
      - Attendance: 0 - 100%
      - Internal Examination Marks: 0 - 40 marks
      - Assignment Marks: 0 - 10 marks
      - Previous Semester CGPA: 0.0 - 10.0
      
    NOTE ON SYNTHETIC DATA:
    This dataset is programmatically generated solely for educational and
    demonstration purposes. It does NOT represent real students from any college
    and should NOT be used as proof of real-world predictive validity.
    """
    print("[1/5] Generating synthetic student dataset with updated evaluation structure...")
    
    records = []
    student_ids = [f"STU{1001 + i}" for i in range(num_samples)]
    
    for i in range(num_samples):
        # Academic profiles distribution
        profile_type = np.random.choice(["high", "medium", "low"], p=[0.45, 0.35, 0.20])
        
        if profile_type == "high":
            # Consistent, high-performing students
            attendance = round(np.random.uniform(75.0, 98.0), 1)
            internal_marks = round(np.random.uniform(25.6, 39.2), 1)
            assignment_marks = round(np.random.uniform(7.0, 10.0), 1)
            cgpa = round(np.random.uniform(7.5, 9.8), 2)
        elif profile_type == "medium":
            # Average students with varying consistency
            attendance = round(np.random.uniform(60.0, 84.0), 1)
            internal_marks = round(np.random.uniform(17.6, 28.8), 1)
            assignment_marks = round(np.random.uniform(5.0, 8.0), 1)
            cgpa = round(np.random.uniform(5.8, 7.6), 2)
        else:
            # Struggling students facing academic challenges
            attendance = round(np.random.uniform(35.0, 68.0), 1)
            internal_marks = round(np.random.uniform(8.0, 20.0), 1)
            assignment_marks = round(np.random.uniform(2.0, 6.0), 1)
            cgpa = round(np.random.uniform(3.5, 6.0), 2)
            
        # Ensure values stay strictly within physical boundaries
        attendance = min(100.0, max(0.0, attendance))
        internal_marks = min(40.0, max(0.0, internal_marks))
        assignment_marks = min(10.0, max(0.0, assignment_marks))
        cgpa = min(10.0, max(0.0, cgpa))
        
        # Updated rule-based composite score (0 to 100 scale):
        # Attendance: 25% weight
        # Internal marks (scaled to 100): 35% weight (out of 40)
        # Assignment marks (scaled to 100): 15% weight (out of 10)
        # Previous CGPA (scaled to 100): 25% weight (out of 10)
        composite_score = (
            (0.25 * attendance) +
            (0.35 * (internal_marks / 40.0) * 100.0) +
            (0.15 * (assignment_marks / 10.0) * 100.0) +
            (0.25 * (cgpa / 10.0) * 100.0)
        )
        
        # Updated Category Assignment Rules:
        # - "At Risk": Composite Score < 50 OR Attendance < 60 OR Internal Marks < 14.4
        # - "On Track": Composite Score >= 72 AND Attendance >= 75 AND Internal Marks >= 24
        # - "Needs Attention": All other cases
        if composite_score < 50.0 or attendance < 60.0 or internal_marks < 14.4:
            category = "At Risk"
        elif composite_score >= 72.0 and attendance >= 75.0 and internal_marks >= 24.0:
            category = "On Track"
        else:
            category = "Needs Attention"
            
        records.append({
            "student_id": student_ids[i],
            "attendance": attendance,
            "internal_marks": internal_marks,
            "assignment_marks": assignment_marks,
            "cgpa": cgpa,
            "performance_category": category
        })
        
    df = pd.DataFrame(records)
    df.to_csv(filepath, index=False)
    print(f"    --> Successfully created '{filepath}' with {len(df)} records.")
    print("    --> Category Distribution:")
    print(df["performance_category"].value_counts().to_string())
    return df

def train_and_evaluate(dataset_path="student_data.csv", model_path="model.pkl"):
    """
    Generates dataset with new marks boundaries, trains a Decision Tree Classifier,
    prints metrics, and saves the trained model bundle to disk.
    """
    # 1. Generate fresh dataset with updated marks evaluation structure
    df = generate_synthetic_data(num_samples=200, filepath=dataset_path)
        
    # 2. Define Features and Target
    feature_cols = ["attendance", "internal_marks", "assignment_marks", "cgpa"]
    target_col = "performance_category"
    
    X = df[feature_cols]
    y = df[target_col]
    
    print(f"\n[2/5] Features selected: {feature_cols}")
    print(f"      Target column: {target_col}")
    
    # 3. Train-Test Split (80% training, 20% testing)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"\n[3/5] Dataset split completed:")
    print(f"      Training samples: {len(X_train)}")
    print(f"      Testing samples:  {len(X_test)}")
    
    # 4. Train Decision Tree Classifier
    print("\n[4/5] Training Decision Tree Classifier (max_depth=4)...")
    clf = DecisionTreeClassifier(
        criterion="gini",
        max_depth=4,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42
    )
    clf.fit(X_train, y_train)
    
    # 5. Evaluate Model
    y_train_pred = clf.predict(X_train)
    y_test_pred = clf.predict(X_test)
    
    train_acc = accuracy_score(y_train, y_train_pred)
    test_acc = accuracy_score(y_test, y_test_pred)
    
    print("\n================ MODEL EVALUATION METRICS ================")
    print(f"Training Accuracy : {train_acc * 100:.2f}%")
    print(f"Testing Accuracy  : {test_acc * 100:.2f}%")
    print("\nConfusion Matrix (Test Set):")
    labels = ["On Track", "Needs Attention", "At Risk"]
    cm = confusion_matrix(y_test, y_test_pred, labels=labels)
    cm_df = pd.DataFrame(cm, index=[f"Actual {l}" for l in labels], columns=[f"Pred {l}" for l in labels])
    print(cm_df)
    
    print("\nClassification Report (Test Set):")
    print(classification_report(y_test, y_test_pred, labels=labels, zero_division=0))
    
    print("Feature Importances:")
    for col, imp in zip(feature_cols, clf.feature_importances_):
        print(f"  - {col:20s}: {imp * 100:.2f}%")
    print("==========================================================")
    
    # 6. Save Model and Metadata
    bundle = {
        "model": clf,
        "feature_names": feature_cols,
        "target_labels": labels,
        "train_accuracy": train_acc,
        "test_accuracy": test_acc
    }
    joblib.dump(bundle, model_path)
    print(f"\n[5/5] Trained model successfully saved to '{model_path}'")
    print("Done! You can now run the Streamlit application using:\n  python -m streamlit run app.py")

if __name__ == "__main__":
    train_and_evaluate()
