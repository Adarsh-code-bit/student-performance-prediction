# 🎯 THE DROP — Student Academic Intelligence & Faculty Terminal

An industrial-grade, white-box Machine Learning decision support terminal engineered for college faculty, academic mentors, and department heads. Built on a deterministic `DecisionTreeClassifier` (Gini Impurity, Depth 4) to monitor student trajectories, prevent academic drop-out, and explain classification logic transparently.

---

## 📌 Application Architecture: 4 Unified Views

1. **◈ OVERVIEW (`#dashboard`):**
   - 4 Real-time KPI Metric cards (`200 Total Cohort`, `93 On Track`, `69 Needs Attention`, `38 At Risk`).
   - Visual Performance Distribution split-bar with segment proportions.
   - **Needs Your Attention First** urgency watchlist (students in At Risk sorted by CGPA and attendance severity with 1-click inspection).
   - **Explainability Architecture Guide** separating ML cognitive classification from administrative statutory rules.

2. **✈ DEPARTURES (`#records`):**
   - Airport terminal departures flight board with Gate pills (`Gate A`, `Gate B`, `Gate C`).
   - Dynamic category filter pills (`ALL 200`, `ON TRACK 93`, `NEEDS ATTENTION 69`, `AT RISK 38`).
   - Real-time search by Student ID.
   - Sample Mode switch: Toggle between the 12 representative demo students and the full 200-student cohort.
   - Interactive table with sticky headers, `LOW` attendance warnings, status badges, and 1-click check-in.

3. **🎫 CHECK-IN DESK (`#predictor`):**
   - Real-time inference sliders (Previous CGPA, Internal Marks /40, Attendance %, Assignment Marks /10).
   - "Reset to Class Average" and tactile "Print Boarding Pass" button.
   - Authentic physical Boarding Pass ticket with status split-flap tiles, decision rule trail, stamped exam eligibility badge, barcode, and Gate badge.

4. **⚙ THE MACHINE (`#model`):**
   - Interactive SVG Decision Tree canvas with animated marble physics dropping along the exact decision path.
   - "Drop Student" and "Drop All 200 Cohort" simulation buttons.
   - Step-by-step logic breakdown ("The Questions It Asks").
   - Verified Accuracy tiles: **97.5% Training Accuracy** (160 samples), **92.5% Testing Accuracy** (40 samples).
   - Feature Importance progress meters (CGPA 87.9%, Internal Marks 11.4%, Assignment 0.6%, Attendance 0.0%).
   - Institutional Audit & Viva Defense FAQ explaining why attendance is kept separate from capability classification.

---

## 🏗️ Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Language** | Python 3.10+ / 3.14 | Core programming language |
| **Web Server** | Flask & Gunicorn | Production WSGI backend & REST APIs |
| **Frontend** | Vanilla ES6+ & SVG | Zero-dependency high-performance reactive UI |
| **Machine Learning** | Scikit-learn | White-box `DecisionTreeClassifier` (Gini, Depth 4) |
| **Data Handling** | Pandas & NumPy | Deterministic 200-student cohort data pipeline |
| **Model Persistence**| Joblib | Serialization of trained decision tree model |

---

## 🚀 Run Command

```powershell
python app.py
```
Open **http://localhost:5001** (or port displayed in the console) in your browser.
| **Model Persistence**| Joblib | Fast binary model serialization and reloading |
| **Web Interface** | Streamlit | Reactive interactive faculty dashboard |

---

## 📊 Academic Features & Target Categories

### 1. Input Features
1. **Attendance Percentage (`0.0 - 100.0%`):** Regularity in lectures and practical sessions. College eligibility norm is typically 75%.
2. **Internal Examination Marks (`0.0 - 40.0`):** Midterm theoretical assessment score (out of 40).
3. **Assignment Marks (`0.0 - 10.0`):** Continuous homework and mini-project assessment (out of 10).
4. **Previous Semester CGPA (`0.0 - 10.0`):** Historical Cumulative Grade Point Average.

### 2. Prediction Categories
- 🟢 **On Track:** Consistent performance across all academic indicators. Recommended for advanced projects and peer mentoring.
- 🟡 **Needs Attention:** Borderline performance or dipping attendance. Recommended for academic counseling and targeted tutorials.
- 🔴 **At Risk:** Critically low attendance (<60%) or failing examination marks. Recommended for immediate remedial intervention and parental notification.

---

## 📁 Project Directory Structure

```text
student_performance_prediction_app/
│
├── app.py                 # Streamlit web application with Dashboard, Predictor & Analytics
├── train_model.py         # Script to generate synthetic data, train Decision Tree & save model.pkl
├── student_data.csv       # Sample synthetic dataset containing 200 student records
├── model.pkl              # Serialized Decision Tree model bundle (saved by train_model.py)
├── requirements.txt       # List of required Python packages
├── viva_questions.md      # 15 detailed viva questions and answers for academic defense
└── README.md              # Complete project documentation and execution guide
```

### Purpose of Every Project File:
1. **`train_model.py`:** Generates the sample synthetic dataset (`student_data.csv`), trains a `DecisionTreeClassifier` with `max_depth=4`, calculates evaluation metrics (Accuracy, Confusion Matrix, Classification Report), and serializes the trained model bundle to `model.pkl`.
2. **`student_data.csv`:** Stores the 200 synthetic student academic profiles used to train and test the model.
3. **`model.pkl`:** The trained machine learning model bundle saved using `joblib`. It contains the trained classifier, feature names, and test metrics.
4. **`app.py`:** The Streamlit web application. It loads `model.pkl` and `student_data.csv` to render the Home Dashboard, Interactive Prediction Form, and Matplotlib Analytics charts.
5. **`requirements.txt`:** Specifies all Python library dependencies for simple one-command installation.
6. **`viva_questions.md`:** Comprehensive preparation guide featuring 15 standard viva questions with simple, accurate answers covering ML concepts, Decision Trees, and data ethics.
7. **`README.md`:** Primary architectural guide and instructions manual.

---

## ⚙️ Step-by-Step Installation & Execution Guide

Follow these commands in your command prompt, PowerShell, or terminal:

### Step 1: Open Terminal in the Project Directory
```bash
cd student_performance_prediction_app
```

### Step 2: Install Required Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Train the Machine Learning Model
Run the training script to generate the synthetic dataset, train the Decision Tree, evaluate metrics, and save `model.pkl`:
```bash
python train_model.py
```
*Expected Output:*
- Generates `student_data.csv` with 200 records.
- Splits data: 160 Training samples, 40 Testing samples.
- Displays Training Accuracy (~97.5%) and Testing Accuracy (~92.5%).
- Displays Confusion Matrix and Classification Report.
- Saves `model.pkl`.

### Step 4: Launch the Streamlit Web Application
```bash
python -m streamlit run app.py
```
The application will launch automatically in your default browser at:
`http://localhost:8501`

---

## 🧠 Machine Learning Workflow (in Simple English)

1. **Step 1: Data Generation & Ingestion (`student_data.csv`)**  
   We create 200 student academic records with 4 measurable features: attendance, internal marks, assignment marks, and previous CGPA. Each student is labeled based on a transparent composite academic scoring rule.

2. **Step 2: Train/Test Split**  
   The 200 records are split into two groups: 80% (160 students) for **training** and 20% (40 students) for **testing**. Stratified sampling ensures that both sets have identical proportions of On Track, Needs Attention, and At Risk students.

3. **Step 3: Training the Decision Tree (`DecisionTreeClassifier`)**  
   The algorithm learns logical if-else split rules (e.g., *Is attendance < 60%?*, *Is CGPA < 6.0?*). It uses the **Gini Impurity** metric to find the cleanest splits. To avoid memorization (overfitting), we set `max_depth=4`.

4. **Step 4: Model Evaluation**  
   The model is tested against the 40 unseen test students. We compute the exact **Accuracy**, **Confusion Matrix**, **Precision**, **Recall**, and **F1-Score**.

5. **Step 5: Model Persistence (`model.pkl`)**  
   The trained decision tree is saved to disk using `joblib`. This allows the web app to load the ready-made model instantly without retraining from scratch every time.

6. **Step 6: Live Inference & Visualization (`app.py`)**  
   Professors interact with the model through an intuitive Streamlit interface, sliding values and receiving real-time predictions, probabilities, and advisory recommendations.

---

## ⚠️ Synthetic Data Transparency Disclaimer

> **Important Note for Academic Examiners & Evaluators:**  
> The dataset (`student_data.csv`) utilized in this application is **synthetically generated demonstration data** created specifically for educational and demonstration purposes. It does **not** reflect real student records from any collegiate institution, nor should it be used as clinical proof of real-world predictive validity. In real institutional deployments, real anonymized data compliant with student data privacy laws must be collected and validated longitudinally.
