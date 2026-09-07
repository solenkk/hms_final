-- ============================================================
-- HMS Database Schema (PostgreSQL DDL)
-- Clinic: Kassahun Medium Clinic, Shagar City, Oromia, Ethiopia
-- Currency: ETB (Ethiopian Birr)
-- Stack: Python + FastAPI, PostgreSQL, React frontend, local Windows desktop server
-- Language: English + Amharic (bilingual UI)
-- Compliance: Ethiopia Proclamation 1321/2024 (UTF-8 encoded)

-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create sequences for auto-number generation
CREATE SEQUENCE IF NOT EXISTS patient_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS visit_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS lab_order_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS admission_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

--------------------------------------------------------------------------------
-- 1. Reference / Support Tables
--------------------------------------------------------------------------------

CREATE TABLE languages (
    id SERIAL PRIMARY KEY,
    code VARCHAR(5) NOT NULL UNIQUE, -- e.g. 'en', 'am'
    name VARCHAR(50) NOT NULL
);

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- 'admin', 'doctor', 'nurse', 'receptionist', 'lab_technician', 'pharmacist', 'cashier'
    description_en TEXT,
    description_am TEXT
);

--------------------------------------------------------------------------------
-- 2. Core User & Identity Tables
--------------------------------------------------------------------------------

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name_en VARCHAR(200) NOT NULL,
    full_name_am VARCHAR(200),
    role_id INTEGER NOT NULL REFERENCES roles(id),
    phone VARCHAR(20),
    email VARCHAR(150) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    preferred_language VARCHAR(5) DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

--------------------------------------------------------------------------------
-- 3. Patient Tables
--------------------------------------------------------------------------------

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_number VARCHAR(20) NOT NULL UNIQUE, -- auto-generated format: CL-YYYY-NNNNN
    first_name_en VARCHAR(100) NOT NULL,
    first_name_am VARCHAR(100),
    last_name_en VARCHAR(100) NOT NULL,
    last_name_am VARCHAR(100),
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    phone VARCHAR(20),
    phone_secondary VARCHAR(20),
    address_en TEXT,
    address_am TEXT,
    kebele VARCHAR(100),
    woreda VARCHAR(100),
    city VARCHAR(100) DEFAULT 'Addis Ababa',
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(100),
    blood_type VARCHAR(5) CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown')),
    allergies TEXT, -- free text, comma-separated
    chronic_conditions TEXT, -- free text
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    consent_date TIMESTAMPTZ,
    consent_version VARCHAR(10), -- tracks which version of consent form was signed
    data_retention_until DATE, -- 10 years from last visit per proclamation guidance
    registered_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE patient_identifiers (
    id SERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    id_type VARCHAR(50) NOT NULL, -- 'national_id', 'passport', 'kebele_id', 'other'
    id_number VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- 4. Visits & Clinical Records
--------------------------------------------------------------------------------

CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_number VARCHAR(20) NOT NULL UNIQUE, -- format: V-YYYY-NNNNN
    patient_id UUID NOT NULL REFERENCES patients(id),
    visit_type VARCHAR(20) NOT NULL CHECK (visit_type IN ('opd', 'inpatient', 'emergency', 'follow_up')),
    visit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attending_doctor_id UUID NOT NULL REFERENCES users(id),
    triage_nurse_id UUID REFERENCES users(id),
    chief_complaint_en TEXT,
    chief_complaint_am TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'referred', 'cancelled')),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id),
    recorded_by UUID NOT NULL REFERENCES users(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    weight_kg NUMERIC(5,2),
    height_cm NUMERIC(5,1),
    bmi NUMERIC(4,1), -- auto-calculated, store for reporting
    temperature_c NUMERIC(4,1),
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    pulse_bpm INTEGER,
    respiratory_rate INTEGER,
    oxygen_saturation NUMERIC(4,1),
    blood_glucose_mgdl NUMERIC(6,1),
    notes TEXT
);

CREATE TABLE emr_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id),
    authored_by UUID NOT NULL REFERENCES users(id),
    note_type VARCHAR(30) NOT NULL CHECK (note_type IN ('history', 'examination', 'assessment', 'plan', 'progress', 'discharge_summary')),
    content_en TEXT,
    content_am TEXT,
    structured_data JSONB, -- JSON structured schema below
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_signed BOOLEAN NOT NULL DEFAULT FALSE,
    signed_at TIMESTAMPTZ,
    is_amended BOOLEAN NOT NULL DEFAULT FALSE,
    amendment_reason TEXT
);

-- structured_data JSONB schema documentation:
-- For note_type = 'history': { "presenting_complaint": "", "duration": "", "onset": "", "hpi": "", "past_medical_history": [], "family_history": "", "social_history": "", "medications": [], "allergies": [] }
-- For note_type = 'examination': { "general_appearance": "", "systems": { "cardiovascular": "", "respiratory": "", "gastrointestinal": "", "neurological": "", "musculoskeletal": "", "skin": "", "other": "" } }
-- For note_type = 'assessment': { "diagnoses": [{ "icd10_code": "", "description_en": "", "description_am": "", "type": "primary|secondary" }] }
-- For note_type = 'plan': { "investigations": [], "medications": [], "referrals": [], "follow_up_date": "", "patient_instructions_en": "", "patient_instructions_am": "" }

CREATE TABLE diagnoses (
    id SERIAL PRIMARY KEY,
    icd10_code VARCHAR(10) NOT NULL UNIQUE,
    description_en VARCHAR(300) NOT NULL,
    description_am VARCHAR(300),
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE
);

--------------------------------------------------------------------------------
-- 5. Pharmacy & Drugs
--------------------------------------------------------------------------------

CREATE TABLE drugs (
    id SERIAL PRIMARY KEY,
    name_generic_en VARCHAR(200) NOT NULL,
    name_generic_am VARCHAR(200),
    name_brand VARCHAR(200),
    drug_form VARCHAR(50) NOT NULL, -- 'tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'other'
    strength VARCHAR(100), -- e.g. '500mg', '250mg/5ml'
    unit_of_measure VARCHAR(50) NOT NULL, -- 'tablet', 'ml', 'vial', 'tube'
    current_stock INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 10,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    supplier VARCHAR(200),
    storage_conditions VARCHAR(200),
    controlled_substance BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE drug_batches (
    id SERIAL PRIMARY KEY,
    drug_id INTEGER NOT NULL REFERENCES drugs(id),
    batch_number VARCHAR(100) NOT NULL,
    quantity_received INTEGER NOT NULL,
    quantity_remaining INTEGER NOT NULL,
    manufacture_date DATE,
    expiry_date DATE NOT NULL,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_by UUID NOT NULL REFERENCES users(id),
    supplier VARCHAR(200),
    purchase_price NUMERIC(10,2),
    notes TEXT
);

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id),
    prescribed_by UUID NOT NULL REFERENCES users(id),
    prescribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending_payment', 'pending', 'dispensed', 'partially_dispensed', 'cancelled')),
    notes TEXT
);

CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    drug_id INTEGER NOT NULL REFERENCES drugs(id),
    dose VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    instructions_en TEXT,
    instructions_am TEXT,
    dispensed_quantity INTEGER DEFAULT 0,
    dispensed_by UUID REFERENCES users(id),
    dispensed_at TIMESTAMPTZ
);

--------------------------------------------------------------------------------
-- 6. Lab Module
--------------------------------------------------------------------------------

CREATE TABLE lab_test_types (
    id SERIAL PRIMARY KEY,
    name_en VARCHAR(200) NOT NULL,
    name_am VARCHAR(200),
    category VARCHAR(100), -- 'haematology', 'biochemistry', 'microbiology', 'urinalysis', 'serology', 'parasitology', 'histology', 'other'
    sample_type VARCHAR(100), -- 'blood', 'urine', 'stool', 'sputum', 'swab', 'tissue', 'other'
    turnaround_hours INTEGER,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    instructions_en TEXT,
    instructions_am TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE lab_result_parameters (
    id SERIAL PRIMARY KEY,
    test_type_id INTEGER NOT NULL REFERENCES lab_test_types(id),
    parameter_name_en VARCHAR(200) NOT NULL,
    parameter_name_am VARCHAR(200),
    unit VARCHAR(50),
    normal_range_min NUMERIC(10,3),
    normal_range_max NUMERIC(10,3),
    normal_range_text VARCHAR(200), -- for non-numeric ranges like 'Negative', '< 5'
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE lab_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) NOT NULL UNIQUE, -- format: L-YYYY-NNNNN
    visit_id UUID NOT NULL REFERENCES visits(id),
    ordered_by UUID NOT NULL REFERENCES users(id),
    ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    priority VARCHAR(10) NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
    clinical_notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sample_collected', 'processing', 'completed', 'cancelled'))
);

CREATE TABLE lab_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id UUID NOT NULL REFERENCES lab_orders(id),
    test_type_id INTEGER NOT NULL REFERENCES lab_test_types(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'sample_collected', 'processing', 'completed', 'cancelled')),
    sample_collected_at TIMESTAMPTZ,
    sample_collected_by UUID REFERENCES users(id),
    resulted_at TIMESTAMPTZ,
    resulted_by UUID REFERENCES users(id),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ
);

CREATE TABLE lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_item_id UUID NOT NULL REFERENCES lab_order_items(id),
    parameter_id INTEGER NOT NULL REFERENCES lab_result_parameters(id),
    result_value VARCHAR(200),
    result_numeric NUMERIC(10,3),
    is_abnormal BOOLEAN,
    abnormal_flag VARCHAR(5), -- 'H', 'L', 'HH', 'LL'
    notes TEXT
);

--------------------------------------------------------------------------------
-- 7. Beds & Wards (IPD Admissions)
--------------------------------------------------------------------------------

CREATE TABLE wards (
    id SERIAL PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL,
    name_am VARCHAR(100),
    floor VARCHAR(20),
    capacity INTEGER NOT NULL,
    ward_type VARCHAR(50), -- 'general', 'private', 'icu', 'maternity', 'paediatric', 'emergency'
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE beds (
    id SERIAL PRIMARY KEY,
    ward_id INTEGER NOT NULL REFERENCES wards(id),
    bed_number VARCHAR(20) NOT NULL,
    bed_type VARCHAR(50) NOT NULL, -- 'general', 'private', 'icu', 'maternity', 'paediatric'
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    notes TEXT
);

CREATE TABLE admissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_number VARCHAR(20) NOT NULL UNIQUE, -- format: A-YYYY-NNNNN
    patient_id UUID NOT NULL REFERENCES patients(id),
    visit_id UUID NOT NULL REFERENCES visits(id),
    bed_id INTEGER NOT NULL REFERENCES beds(id),
    admitted_by UUID NOT NULL REFERENCES users(id),
    admitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    admitting_diagnosis_en TEXT,
    admitting_diagnosis_am TEXT,
    discharge_date TIMESTAMPTZ,
    discharged_by UUID REFERENCES users(id),
    discharge_summary TEXT,
    discharge_condition VARCHAR(50) CHECK (discharge_condition IN ('improved', 'recovered', 'referred', 'absconded', 'deceased', NULL)),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discharged', 'transferred'))
);

--------------------------------------------------------------------------------
-- 8. Billing & Payments
--------------------------------------------------------------------------------

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(20) NOT NULL UNIQUE, -- format: INV-YYYY-NNNNN
    visit_id UUID NOT NULL REFERENCES visits(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'cancelled', 'waived')),
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_reason TEXT,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'bank_transfer', 'insurance', 'mobile_money', 'waived', NULL)),
    notes TEXT
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('consultation', 'lab', 'pharmacy', 'bed', 'procedure', 'other')),
    description_en VARCHAR(300) NOT NULL,
    description_am VARCHAR(300),
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL,
    reference_id UUID -- links to lab_order_item, prescription_item, or admission
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    received_by UUID NOT NULL REFERENCES users(id),
    amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'insurance', 'mobile_money', 'waived')),
    payment_reference VARCHAR(200), -- receipt number, transaction ID, etc.
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

--------------------------------------------------------------------------------
-- 9. Compliance & Auditing
--------------------------------------------------------------------------------

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- 'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PRINT', 'FAILED_LOGIN'
    resource_type VARCHAR(100) NOT NULL, -- e.g. 'patient', 'emr_note', 'lab_result'
    resource_id VARCHAR(100), -- UUID or ID of the affected record
    patient_id UUID REFERENCES patients(id), -- for fast patient-centric audit queries
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

CREATE TABLE consent_versions (
    id SERIAL PRIMARY KEY,
    version VARCHAR(10) NOT NULL UNIQUE,
    content_en TEXT NOT NULL,
    content_am TEXT NOT NULL,
    effective_date DATE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE city_report_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    report_type VARCHAR(100), -- 'monthly_morbidity', 'weekly_disease', 'annual_summary'
    frequency VARCHAR(50), -- 'weekly', 'monthly', 'quarterly', 'annual'
    last_generated TIMESTAMPTZ,
    template_config JSONB
);

--------------------------------------------------------------------------------
-- Indexes
--------------------------------------------------------------------------------

CREATE INDEX idx_patients_patient_number ON patients(patient_number);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_visits_visit_date ON visits(visit_date);
CREATE INDEX idx_visits_patient_id ON visits(patient_id);
CREATE INDEX idx_lab_orders_order_number ON lab_orders(order_number);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_patient_id ON audit_log(patient_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);

--------------------------------------------------------------------------------
-- Triggers and Functions
--------------------------------------------------------------------------------

-- Trigger to set updated_at automatically on UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trigger_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trigger_visits_updated_at BEFORE UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trigger_emr_notes_updated_at BEFORE UPDATE ON emr_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trigger_drugs_updated_at BEFORE UPDATE ON drugs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-number generators
CREATE OR REPLACE FUNCTION auto_patient_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.patient_number := 'CL-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('patient_number_seq')::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_patient_number BEFORE INSERT ON patients FOR EACH ROW EXECUTE FUNCTION auto_patient_number();

CREATE OR REPLACE FUNCTION auto_visit_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.visit_number := 'V-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('visit_number_seq')::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_visit_number BEFORE INSERT ON visits FOR EACH ROW EXECUTE FUNCTION auto_visit_number();

CREATE OR REPLACE FUNCTION auto_lab_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number := 'L-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('lab_order_number_seq')::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_lab_order_number BEFORE INSERT ON lab_orders FOR EACH ROW EXECUTE FUNCTION auto_lab_order_number();

CREATE OR REPLACE FUNCTION auto_admission_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.admission_number := 'A-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('admission_number_seq')::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_admission_number BEFORE INSERT ON admissions FOR EACH ROW EXECUTE FUNCTION auto_admission_number();

CREATE OR REPLACE FUNCTION auto_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.invoice_number := 'INV-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_invoice_number BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION auto_invoice_number();

--------------------------------------------------------------------------------
-- Seed Data (Basic Setup)
--------------------------------------------------------------------------------

-- Languages
INSERT INTO languages (code, name) VALUES 
('en', 'English'),
('am', 'Amharic');

-- Roles
INSERT INTO roles (name, description_en, description_am) VALUES
('admin', 'Administrator with full system privileges', 'ሙሉ የስርዓት መብቶች ያለው አስተዳዳሪ'),
('doctor', 'Medical Doctor / Clinician', 'ሐኪም / ክሊኒሻን'),
('nurse', 'Triage & Ward Nurse', 'ትሪያጅ እና ዋርድ ነርስ'),
('receptionist', 'Reception & Registration Staff', 'ሪሴፕሽን እና ምዝገባ ሰራተኛ'),
('lab_technician', 'Laboratory Technician', 'የላብራቶሪ ባለሙያ'),
('pharmacist', 'Pharmacist / Dispenser', 'የፋርማሲ ባለሙያ / አከፋፋይ'),
('cashier', 'Billing & Cashier Staff', 'የክፍያ እና ገንዘብ ያዥ ሰራተኛ');

-- Seed Admin User (temporary password hash for 'CHANGE_ME_ON_FIRST_LOGIN')
-- We use a dummy bcrypt hash matching $2b$12$R.Sj9uP1vC/5vT3P9P8NGu3a6nN69zW.8x72J/zB13uV/D4mN8zLu for 'CHANGE_ME_ON_FIRST_LOGIN'
INSERT INTO users (username, password_hash, full_name_en, full_name_am, role_id, phone, email, preferred_language)
VALUES (
    'admin',
    '$2b$12$R.Sj9uP1vC/5vT3P9P8NGu3a6nN69zW.8x72J/zB13uV/D4mN8zLu',
    'System Administrator',
    'የስርዓት አስተዳዳሪ',
    (SELECT id FROM roles WHERE name='admin'),
    '+251911000000',
    'admin@clinic.et',
    'en'
);

-- Consent Version 1.0
INSERT INTO consent_versions (version, content_en, content_am, effective_date, created_by)
VALUES (
    '1.0',
    'I hereby consent to the collection, processing, and retention of my personal and health data for the purposes of medical treatment, billing, and reporting as required by Ethiopia Proclamation 1321/2024.',
    'በኢትዮጵያ አዋጅ 1321/2024 መሠረት ለህክምና፣ ለክፍያ እና ሪፖርት ለማድረግ የእኔ የግል እና የጤና መረጃዎች እንዲሰበሰቡ፣ እንዲቀነባበሩ እና እንዲቀመጡ በዚህ እስማማለሁ።',
    CURRENT_DATE,
    (SELECT id FROM users WHERE username='admin')
);
