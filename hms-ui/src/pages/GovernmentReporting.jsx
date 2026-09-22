import React, { useState, useEffect, useMemo } from 'react'
import { reportsApi, apiError } from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, Search, FileText, CheckCircle2, ChevronRight, ChevronDown, Activity } from 'lucide-react'

const CLINICAL_OCCURRENCES = [
  // Reproductive & Maternal Health
  { id: 'anc_first', title: 'First ANC Contact', category: 'Reproductive & Maternal Health', searchTerms: ['anc', 'antenatal', 'pregnancy', 'first'], fields: [{ name: 'gestational_week', label: 'Gestational week', type: 'number', required: true }], getEvent: (data) => ({ clinical_event_code: 'ANC_CONTACT_1', payload: { gestational_week: parseInt(data.gestational_week) } }), formatResult: (data) => `ANC First Contact — ${data.gestational_week} weeks` },
  { id: 'anc_fourth', title: '4+ ANC Contacts', category: 'Reproductive & Maternal Health', searchTerms: ['anc', 'antenatal', 'pregnancy', '4', 'fourth'], fields: [{ name: 'gestational_week', label: 'Gestational week', type: 'number', required: true }], getEvent: (data) => ({ clinical_event_code: 'ANC_CONTACT_4', payload: { gestational_week: parseInt(data.gestational_week) } }), formatResult: (data) => `ANC 4+ Contacts — ${data.gestational_week} weeks` },
  { id: 'anc_eight', title: '8+ ANC Contacts', category: 'Reproductive & Maternal Health', searchTerms: ['anc', 'antenatal', 'pregnancy', '8', 'eight'], fields: [{ name: 'gestational_week', label: 'Gestational week', type: 'number', required: true }], getEvent: (data) => ({ clinical_event_code: 'ANC_CONTACT_8', payload: { gestational_week: parseInt(data.gestational_week) } }), formatResult: (data) => `ANC 8+ Contacts — ${data.gestational_week} weeks` },
  { id: 'contraceptive_new', title: 'New contraceptive acceptance', category: 'Reproductive & Maternal Health', searchTerms: ['contraceptive', 'family planning', 'fp', 'new'], fields: [{ name: 'method', label: 'Method', type: 'select', options: [{ value: 'pill', label: 'Pills' }, { value: 'injectable', label: 'Injectables' }, { value: 'implant', label: 'Implants' }, { value: 'iud', label: 'IUCD' }], required: true }], getEvent: (data) => ({ clinical_event_code: `CONTRACEPTIVE_NEW`, payload: { method: data.method } }), formatResult: (data) => `New contraceptive acceptance — ${data.method}` },
  { id: 'contraceptive_repeat', title: 'Repeat contraceptive acceptance', category: 'Reproductive & Maternal Health', searchTerms: ['contraceptive', 'family planning', 'fp', 'repeat'], fields: [{ name: 'method', label: 'Method', type: 'select', options: [{ value: 'pill', label: 'Pills' }, { value: 'injectable', label: 'Injectables' }, { value: 'implant', label: 'Implants' }, { value: 'iud', label: 'IUCD' }], required: true }], getEvent: (data) => ({ clinical_event_code: `CONTRACEPTIVE_REPEAT`, payload: { method: data.method } }), formatResult: (data) => `Repeat contraceptive acceptance — ${data.method}` },
  { id: 'contraceptive_ppfp', title: 'IPPFP Acceptance', category: 'Reproductive & Maternal Health', searchTerms: ['contraceptive', 'family planning', 'fp', 'ippfp', 'postpartum'], fields: [{ name: 'method', label: 'Method', type: 'select', options: [{ value: 'pill', label: 'Pills' }, { value: 'injectable', label: 'Injectables' }, { value: 'implant', label: 'Implants' }, { value: 'iud', label: 'IUCD' }], required: true }], getEvent: (data) => ({ clinical_event_code: `CONTRACEPTIVE_PPFP`, payload: { method: data.method } }), formatResult: (data) => `IPPFP Acceptance — ${data.method}` },
  { id: 'contraceptive_prem_removal', title: 'PRLAFP (Premature Removal LAFP)', category: 'Reproductive & Maternal Health', searchTerms: ['contraceptive', 'family planning', 'fp', 'prlafp', 'removal', 'premature'], fields: [{ name: 'method', label: 'Method', type: 'select', options: [{ value: 'implant', label: 'Implants' }, { value: 'iud', label: 'IUCD' }], required: true }], getEvent: (data) => ({ clinical_event_code: `CONTRACEPTIVE_PREM_REMOVAL`, payload: { method: data.method } }), formatResult: (data) => `PRLAFP (Method) — ${data.method}` },
  { id: 'contraceptive_removal', title: 'Total LAFP Removal', category: 'Reproductive & Maternal Health', searchTerms: ['contraceptive', 'family planning', 'fp', 'removal', 'total lafp'], fields: [], getEvent: () => ({ clinical_event_code: `CONTRACEPTIVE_REMOVAL`, payload: {} }), formatResult: () => `Total LAFP Removal` },
  { id: 'live_births', title: 'Number of Live births', category: 'Reproductive & Maternal Health', searchTerms: ['delivery', 'live', 'birth', 'outcome'], fields: [{ name: 'attended_by_skilled', label: 'Attended by Skilled Personnel', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true }, { name: 'method', label: 'Method', type: 'select', options: [{ value: 'NORMAL', label: 'Normal Vaginal' }, { value: 'CS', label: 'Cesarean Section' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'DELIVERY_RECORD', payload: { outcome: 'LIVE', attended_by_skilled: data.attended_by_skilled === 'true', method: data.method } }), formatResult: (data) => `Live Birth` },
  { id: 'still_births', title: 'Number of still births', category: 'Reproductive & Maternal Health', searchTerms: ['delivery', 'stillbirth', 'birth', 'outcome'], fields: [{ name: 'attended_by_skilled', label: 'Attended by Skilled Personnel', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true }, { name: 'method', label: 'Method', type: 'select', options: [{ value: 'NORMAL', label: 'Normal Vaginal' }, { value: 'CS', label: 'Cesarean Section' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'DELIVERY_RECORD', payload: { outcome: 'STILLBIRTH', attended_by_skilled: data.attended_by_skilled === 'true', method: data.method } }), formatResult: (data) => `Stillbirth` },
  { id: 'pph_developed', title: 'Women who developed postpartum hemorrhage (PPH)', category: 'Reproductive & Maternal Health', searchTerms: ['pph', 'hemorrhage', 'postpartum', 'bleeding'], fields: [{ name: 'delivery_location', label: 'Delivery Location', type: 'select', options: [{ value: 'Home delivery', label: 'Home delivery' }, { value: 'Facility delivery', label: 'Facility delivery' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'PPH_DEVELOPED', payload: { delivery_location: data.delivery_location } }), formatResult: (data) => `PPH — ${data.delivery_location}` },
  { id: 'uterotonics_administered', title: 'Women who received uterotonics in the first one minute after delivery', category: 'Reproductive & Maternal Health', searchTerms: ['uterotonics', 'oxytocin', 'mesoprostol', 'ergometrin', 'delivery'], fields: [{ name: 'drug_type', label: 'Drug Type', type: 'select', options: [{ value: 'oxytocin', label: 'oxytocin' }, { value: 'mesoprostol', label: 'mesoprostol' }, { value: 'ergometrin', label: 'ergometrin' }, { value: 'Other uterotonics', label: 'Other uterotonics' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'UTEROTONICS_ADMINISTERED', payload: { drug_type: data.drug_type } }), formatResult: (data) => `Uterotonics — ${data.drug_type}` },
  { id: 'birth_notification', title: 'Institutional birth notification', category: 'Reproductive & Maternal Health', searchTerms: ['birth', 'notification', 'institutional', 'born'], fields: [], getEvent: () => ({ clinical_event_code: 'BIRTH_NOTIFICATION', payload: {} }), formatResult: () => `Institutional Birth Notification` },
  { id: 'death_notification', title: 'Institutional death notification', category: 'Reproductive & Maternal Health', searchTerms: ['death', 'notification', 'institutional', 'died'], fields: [], getEvent: () => ({ clinical_event_code: 'DEATH_NOTIFICATION', payload: {} }), formatResult: () => `Institutional Death Notification` },
  { id: 'postnatal_visit', title: 'Postnatal visits within 7 days of delivery', category: 'Reproductive & Maternal Health', searchTerms: ['postnatal', 'visit', 'delivery', '7 days', 'pnc'], fields: [{ name: 'timing', label: 'Timing', type: 'select', options: [{ value: '24Hrs (1day)', label: '24Hrs (1day)' }, { value: '25 - 48 hrs (1 - 2 days)', label: '25 - 48 hrs (1 - 2 days)' }, { value: '49 - 72 hrs (2 - 3 days)', label: '49 - 72 hrs (2 - 3 days)' }, { value: '73 hrs - 7 days (4 - 7 days)', label: '73 hrs - 7 days (4 - 7 days)' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'POSTNATAL_VISIT', payload: { timing: data.timing } }), formatResult: (data) => `Postnatal Visit — ${data.timing}` },
  { id: 'pregnancy_test', title: 'Total number of women tested positive for pregnancy', category: 'Reproductive & Maternal Health', searchTerms: ['pregnancy', 'test', 'positive'], fields: [{ name: 'result', label: 'Result', type: 'select', options: [{ value: 'POS', label: 'Positive' }, { value: 'NEG', label: 'Negative' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'PREGNANCY_TEST', payload: { result: data.result } }), formatResult: (data) => `Pregnancy Test — ${data.result === 'POS' ? 'Positive' : 'Negative'}` },
  { id: 'abortion_safe', title: 'Number of safe abortions performed', category: 'Reproductive & Maternal Health', searchTerms: ['abortion', 'safe'], fields: [], getEvent: () => ({ clinical_event_code: 'ABORTION_SAFE', payload: {} }), formatResult: () => `Safe Abortion` },
  { id: 'abortion_post_care', title: 'Number of post abortion / emergency care', category: 'Reproductive & Maternal Health', searchTerms: ['abortion', 'post', 'care', 'emergency'], fields: [], getEvent: () => ({ clinical_event_code: 'ABORTION_POST_CARE', payload: {} }), formatResult: () => `Post Abortion Care` },
  { id: 'abortion_comprehensive', title: 'Comprehensive abortion care', category: 'Reproductive & Maternal Health', searchTerms: ['abortion', 'comprehensive', 'trimester'], fields: [{ name: 'trimester', label: 'Trimester', type: 'select', options: [{ value: 'First trimester (<12 Weeks)', label: 'First trimester (<12 Weeks)' }, { value: 'Second trimester (>=12 Weeks)', label: 'Second trimester (>=12 Weeks)' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'ABORTION_COMPREHENSIVE', payload: { trimester: data.trimester } }), formatResult: (data) => `Comprehensive Abortion — ${data.trimester}` },
  { id: 'abortion_post_fp', title: 'Post abortion care family planning methods', category: 'Reproductive & Maternal Health', searchTerms: ['abortion', 'family planning', 'fp', 'method'], fields: [{ name: 'method', label: 'Method', type: 'select', options: [{ value: 'Oral contraceptives', label: 'Oral contraceptives' }, { value: 'Injectables', label: 'Injectables' }, { value: 'Implants', label: 'Implants' }, { value: 'IUCD', label: 'IUCD' }, { value: 'Vasectomy', label: 'Vasectomy' }, { value: 'Tubal ligation', label: 'Tubal ligation' }, { value: 'Others', label: 'Others' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'ABORTION_POST_FP', payload: { method: data.method } }), formatResult: (data) => `Post Abortion FP — ${data.method}` },
  { id: 'fistula_treated', title: 'Obstetric fistula cases treated', category: 'Reproductive & Maternal Health', searchTerms: ['fistula', 'obstetric', 'treated'], fields: [], getEvent: () => ({ clinical_event_code: 'FISTULA_TREATED', payload: {} }), formatResult: () => `Obstetric Fistula Treated` },
  { id: 'maternal_death', title: 'Maternal Death', category: 'Reproductive & Maternal Health', searchTerms: ['death', 'maternal', 'pregnancy', 'mortality'], fields: [], getEvent: () => ({ clinical_event_code: 'MATERNAL_DEATH', payload: {} }), formatResult: () => `Maternal Death` },
  { id: 'neonatal_death', title: 'Institutional neonatal death', category: 'Neonatal & Child Health', searchTerms: ['neonatal', 'death', 'institutional', 'infant', 'born'], fields: [{ name: 'age_at_death', label: 'Age at death', type: 'select', options: [{ value: 'First 24 hrs of life', label: 'First 24 hrs of life' }, { value: '1 - 7 days of life', label: '1 - 7 days of life' }, { value: '8 - 28 days of life', label: '8 - 28 days of life' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'NEONATAL_DEATH', payload: { age_at_death: data.age_at_death } }), formatResult: (data) => `Neonatal Death — ${data.age_at_death}` },
  { id: 'diarrhea_treated', title: 'Diarrhea treated', category: 'Neonatal & Child Health', searchTerms: ['diarrhea', 'ors', 'zinc'], fields: [{ name: 'medication', label: 'Medication given', type: 'select', options: [{ value: 'ORS only', label: 'ORS only' }, { value: 'Zinc and ORS', label: 'Zinc and ORS' }, { value: 'Others', label: 'Others' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'DIARRHEA_TREATED', payload: { medication: data.medication } }), formatResult: (data) => `Diarrhea Treated — ${data.medication}` },
  { id: 'kmc_initiated', title: 'KMC Initiated (Newborns <2000g/premature)', category: 'Neonatal & Child Health', searchTerms: ['kmc', 'kangaroo', 'premature'], fields: [], getEvent: () => ({ clinical_event_code: 'KMC_INITIATED', payload: {} }), formatResult: () => `KMC Initiated` },
  { id: 'newborn_record', title: 'Newborn weight and prematurity record', category: 'Neonatal & Child Health', searchTerms: ['newborn', 'weight', 'premature', '2000', '2500'], fields: [{ name: 'weight', label: 'Weight (grams)', type: 'number', required: true }, { name: 'premature', label: 'Premature?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'NEWBORN_RECORD', payload: { weight: parseInt(data.weight), premature: data.premature === 'true' } }), formatResult: (data) => `Newborn Record — ${data.weight}g, ${data.premature === 'true' ? 'Premature' : 'Full Term'}` },
  { id: 'neonate_resuscitated', title: 'Neonates resuscitated', category: 'Neonatal & Child Health', searchTerms: ['resuscitate', 'neonate', 'survived'], fields: [{ name: 'survived', label: 'Survived?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'NEONATE_RESUSCITATED', payload: { survived: data.survived === 'true' } }), formatResult: (data) => `Resuscitated — ${data.survived === 'true' ? 'Survived' : 'Died'}` },
  { id: 'facility_nicu', title: 'Does the facility provide NICU Service?', category: 'Neonatal & Child Health', searchTerms: ['nicu', 'service', 'facility'], fields: [{ name: 'provides_nicu', label: 'Provides NICU?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'FACILITY_CONFIG', payload: { provides_nicu: data.provides_nicu === 'true' } }), formatResult: (data) => `NICU Config — ${data.provides_nicu === 'true' ? 'Yes' : 'No'}` },
  { id: 'nicu_discharge', title: 'Treatment outcome of neonates admitted to NICU', category: 'Neonatal & Child Health', searchTerms: ['nicu', 'outcome', 'admitted', 'discharged', 'recovered', 'dead', 'transferred'], fields: [{ name: 'outcome', label: 'Outcome', type: 'select', options: [{ value: 'Recovered', label: 'Recovered' }, { value: 'Dead', label: 'Dead' }, { value: 'Transferred', label: 'Transferred' }, { value: 'Others', label: 'Others (Absconded, Left against medical advice)' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'NICU_DISCHARGE', payload: { outcome: data.outcome } }), formatResult: (data) => `NICU Discharge — ${data.outcome}` },
  { id: 'newborn_chx_dose', title: 'Newborns received CHX dose to cord', category: 'Neonatal & Child Health', searchTerms: ['newborn', 'chx', 'chlorhexidine', 'cord'], fields: [], getEvent: () => ({ clinical_event_code: 'NEWBORN_CHX_DOSE', payload: {} }), formatResult: () => `CHX Dose Administered` },
  { id: 'child_dev_assessed', title: 'Children aged 0-59 months assessed for developmental milestone', category: 'Neonatal & Child Health', searchTerms: ['children', 'developmental', 'milestone', 'delay'], fields: [{ name: 'status', label: 'Developmental Status', type: 'select', options: [{ value: 'Suspected Developmental Delay', label: 'Suspected Developmental Delay' }, { value: 'Developmental Delay', label: 'Developmental Delay' }, { value: 'No Developmental Delay', label: 'No Developmental Delay' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'CHILD_DEV_ASSESSED', payload: { status: data.status } }), formatResult: (data) => `Child Dev Assessed — ${data.status}` },
  { id: 'total_live_births', title: 'Total number of live births weighed', category: 'Neonatal & Child Health', searchTerms: ['live', 'births', 'weighed', 'total'], fields: [{ name: 'weight', label: 'Weight (grams)', type: 'number', required: true }], getEvent: (data) => ({ clinical_event_code: 'NEWBORN_RECORD', payload: { weight: parseInt(data.weight) } }), formatResult: (data) => `Live Birth Weighed — ${data.weight}g` },
  { id: 'gmp_weighing_u2', title: 'Children < 2 yr weighted during GMP session', category: 'Neonatal & Child Health', searchTerms: ['gmp', 'weighing', 'children', 'weighted'], fields: [{ name: 'age_band', label: 'Age Group', type: 'select', options: [{ value: '0 - 5 months', label: '0 - 5 months' }, { value: '6 - 23 months', label: '6 - 23 months' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'GMP_WEIGHING', payload: { age_band: data.age_band } }), formatResult: (data) => `GMP Weighing — ${data.age_band}` },
  { id: 'malnutrition_moderate', title: 'Moderate malnutrition by age (Z-score -2 to -3)', category: 'Neonatal & Child Health', searchTerms: ['moderate', 'malnutrition', 'z-score'], fields: [{ name: 'age_band', label: 'Age Group', type: 'select', options: [{ value: '0 - 5 months', label: '0 - 5 months' }, { value: '6 - 23 months', label: '6 - 23 months' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'MALNUTRITION_SCREENING', payload: { z_score_category: 'Moderate (-2 to -3)', age_band: data.age_band } }), formatResult: (data) => `Moderate Malnutrition — ${data.age_band}` },
  { id: 'malnutrition_severe', title: 'Severe malnutrition by age (Z-score below -3)', category: 'Neonatal & Child Health', searchTerms: ['severe', 'malnutrition', 'z-score'], fields: [{ name: 'age_band', label: 'Age Group', type: 'select', options: [{ value: '0 - 5 months', label: '0 - 5 months' }, { value: '6 - 23 months', label: '6 - 23 months' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'MALNUTRITION_SCREENING', payload: { z_score_category: 'Severe (< -3)', age_band: data.age_band } }), formatResult: (data) => `Severe Malnutrition — ${data.age_band}` },
  { id: 'vita_supp', title: 'Vitamin A supplementation', category: 'Neonatal & Child Health', searchTerms: ['vitamin a', 'supplementation', 'age', 'dose'], fields: [{ name: 'age_band', label: 'Age Group', type: 'select', options: [{ value: '6 - 11 months', label: '6 - 11 months' }, { value: '12 - 59 months', label: '12 - 59 months' }], required: true }, { name: 'dose', label: 'Dose', type: 'select', options: [{ value: 'First dose', label: 'First dose' }, { value: 'Second dose', label: 'Second dose' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'VITA_SUPP', payload: { age_band: data.age_band, dose: data.dose } }), formatResult: (data) => `Vitamin A Supp — ${data.age_band}, ${data.dose}` },
  { id: 'deworm_child', title: 'Children 24-59 months dewormed — by dose', category: 'Neonatal & Child Health', searchTerms: ['deworm', 'children', 'dose'], fields: [{ name: 'dose', label: 'Dose', type: 'select', options: [{ value: 'First dose', label: 'First dose' }, { value: 'Second dose', label: 'Second dose' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'DEWORM_CHILD', payload: { dose: data.dose } }), formatResult: (data) => `Deworming (Child) — ${data.dose}` },
  { id: 'deworm_pregnant', title: 'Number of pregnant women de-wormed', category: 'Reproductive & Maternal Health', searchTerms: ['deworm', 'pregnant', 'women'], fields: [], getEvent: () => ({ clinical_event_code: 'DEWORM_PREGNANT', payload: {} }), formatResult: () => `Deworming (Pregnant)` },
  { id: 'preg_ifa_90', title: 'Pregnant women received IFA at least 90 plus (by age)', category: 'Reproductive & Maternal Health', searchTerms: ['ifa', 'iron', 'folic acid', '90 plus', 'pregnant'], fields: [{ name: 'age_band', label: 'Age Group', type: 'select', options: [{ value: '10 - 14 years', label: '10 - 14 years' }, { value: '15 - 19 years', label: '15 - 19 years' }, { value: '>= 20 years', label: '>= 20 years' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'PREG_IFA_90', payload: { age_band: data.age_band } }), formatResult: (data) => `IFA 90+ — ${data.age_band}` },
  { id: 'plw_malnutrition_muac', title: 'PLW screened for acute malnutrition by MUAC status', category: 'Reproductive & Maternal Health', searchTerms: ['plw', 'malnutrition', 'muac', 'pregnant', 'lactating'], fields: [{ name: 'muac_status', label: 'MUAC Status', type: 'select', options: [{ value: 'MUAC < 23 cm', label: 'MUAC < 23 cm' }, { value: 'MUAC >= 23 cm', label: 'MUAC >= 23 cm' }], required: true }, { name: 'maternal_status', label: 'Maternal Status', type: 'select', options: [{ value: 'Pregnant', label: 'Pregnant' }, { value: 'Lactating', label: 'Lactating' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'PLW_MALNUTRITION', payload: { muac_status: data.muac_status, maternal_status: data.maternal_status } }), formatResult: (data) => `PLW Malnutrition (MUAC) — ${data.muac_status}` },
  { id: 'plw_malnutrition_status', title: 'PLW screened for acute malnutrition by maternal status', category: 'Reproductive & Maternal Health', searchTerms: ['plw', 'malnutrition', 'maternal status', 'pregnant', 'lactating'], fields: [{ name: 'muac_status', label: 'MUAC Status', type: 'select', options: [{ value: 'MUAC < 23 cm', label: 'MUAC < 23 cm' }, { value: 'MUAC >= 23 cm', label: 'MUAC >= 23 cm' }], required: true }, { name: 'maternal_status', label: 'Maternal Status', type: 'select', options: [{ value: 'Pregnant', label: 'Pregnant' }, { value: 'Lactating', label: 'Lactating' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'PLW_MALNUTRITION', payload: { muac_status: data.muac_status, maternal_status: data.maternal_status } }), formatResult: (data) => `PLW Malnutrition (Status) — ${data.maternal_status}` },
  { id: 'malnutrition_u5', title: 'Children < 5 yr screened for acute malnutrition', category: 'Neonatal & Child Health', searchTerms: ['screened', 'acute', 'malnutrition', 'total', 'moderate', 'severe'], fields: [{ name: 'age_band', label: 'Age Group', type: 'select', options: [{ value: '0 - 5 months', label: '0 - 5 months' }, { value: '6 - 23 months', label: '6 - 23 months' }, { value: '24 - 59 Months', label: '24 - 59 Months' }], required: true }, { name: 'z_score_category', label: 'Malnutrition Level', type: 'select', options: [{ value: 'Normal', label: 'Normal / Screened Only' }, { value: 'Moderate (-2 to -3)', label: 'Moderate Acute Malnutrition' }, { value: 'Severe (< -3)', label: 'Severe Acute Malnutrition' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'MALNUTRITION_SCREENING', payload: { z_score_category: data.z_score_category, age_band: data.age_band } }), formatResult: (data) => `Malnutrition (< 5 yr) — ${data.age_band}, ${data.z_score_category}` },
  { id: 'obstetric_fistula', title: 'Obstetric Fistula Identified', category: 'Reproductive & Maternal Health', searchTerms: ['fistula', 'obstetric', 'identified'], fields: [], getEvent: () => ({ clinical_event_code: 'FISTULA_IDENTIFIED', payload: {} }), formatResult: () => `Obstetric Fistula Identified` },
  { id: 'syphilis_test', title: 'Preg tested for syphilis', category: 'Reproductive & Maternal Health', searchTerms: ['syphilis', 'test', 'pregnancy', 'std', 'vdrl', 'rpr'], fields: [{ name: 'result', label: 'Result', type: 'select', options: [{ value: 'POSITIVE', label: 'Positive' }, { value: 'NEGATIVE', label: 'Negative' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'SYPHILIS_TEST', payload: { result: data.result } }), formatResult: (data) => `Syphilis Test — ${data.result}` },
  { id: 'syphilis_treatment', title: 'Preg treated for syphilis', category: 'Reproductive & Maternal Health', searchTerms: ['syphilis', 'treatment', 'pregnancy', 'std'], fields: [], getEvent: () => ({ clinical_event_code: 'SYPHILIS_TREATMENT', payload: {} }), formatResult: () => `Syphilis Treatment` },
  { id: 'hepb_test', title: 'Preg tested for Hep B', category: 'Reproductive & Maternal Health', searchTerms: ['hepatitis', 'hep b', 'hbv', 'test', 'pregnancy'], fields: [{ name: 'result', label: 'Result', type: 'select', options: [{ value: 'POSITIVE', label: 'Positive' }, { value: 'NEGATIVE', label: 'Negative' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'HEPB_TEST', payload: { result: data.result } }), formatResult: (data) => `Hep B Test — ${data.result}` },
  { id: 'hepb_prophylaxis', title: 'Preg prophylaxis for HBV', category: 'Reproductive & Maternal Health', searchTerms: ['hepatitis', 'hep b', 'hbv', 'prophylaxis', 'pregnancy', 'vaccine'], fields: [], getEvent: () => ({ clinical_event_code: 'HEPB_PROPHYLAXIS', payload: {} }), formatResult: () => `HBV Prophylaxis` },
  
  // Neonatal & Child Health
  { id: 'u5_pneumonia', title: 'U5 Pneumonia Treatment', category: 'Neonatal & Child Health', searchTerms: ['pneumonia', 'child', 'u5', 'treatment'], fields: [], getEvent: () => ({ clinical_event_code: 'U5_PNEUMONIA_TREATED', payload: {} }), formatResult: () => `U5 Pneumonia Treatment` },
  { id: 'infant_critical', title: 'Sick infant critical illness', category: 'Neonatal & Child Health', searchTerms: ['sick', 'infant', 'critical', 'illness'], fields: [{ name: 'illness_type', label: 'Illness Type', type: 'select', options: [{ value: 'VSD', label: 'VSD' }, { value: 'LBI', label: 'LBI' }, { value: 'PNEUMONIA', label: 'Pneumonia' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'INFANT_CRITICAL_TREATED', payload: { illness_type: data.illness_type } }), formatResult: (data) => `Sick infant critical illness — ${data.illness_type}` },
  { id: 'diarrhea_zinc', title: 'Zinc/ORS diarrhea treatment', category: 'Neonatal & Child Health', searchTerms: ['diarrhea', 'zinc', 'ors', 'treatment'], fields: [{ name: 'medication', label: 'Medication', type: 'select', options: [{ value: 'ORS_ZINC', label: 'ORS + Zinc' }, { value: 'ORS_ONLY', label: 'ORS Only' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'DIARRHEA_TREATED', payload: { medication: data.medication } }), formatResult: (data) => `Diarrhea treatment — ${data.medication}` },
  
  
  // Malaria / NTD / NCD
  { id: 'woreda_elimination', title: 'Woreda elimination', category: 'Malaria / NTD / NCD', searchTerms: ['woreda', 'elimination', 'malaria'], fields: [{ name: 'elimination_district', label: 'Elimination District?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'FACILITY_CONFIG', payload: { elimination_district: data.elimination_district === 'true' } }), formatResult: (data) => `Woreda Elimination — ${data.elimination_district === 'true' ? 'Yes' : 'No'}` },
  { id: 'malaria_test', title: 'Malaria test (slides or RDT)', category: 'Malaria / NTD / NCD', searchTerms: ['malaria', 'test', 'slide', 'rdt'], fields: [{ name: 'age_sex_band', label: 'Age & Sex Group', type: 'select', options: [{ value: '< 5 years, Male', label: '< 5 years, Male' }, { value: '< 5 years, Female', label: '< 5 years, Female' }, { value: '5 - 14 years, Male', label: '5 - 14 years, Male' }, { value: '5 - 14 years, Female', label: '5 - 14 years, Female' }, { value: '>= 15 years, Male', label: '>= 15 years, Male' }, { value: '>= 15 years, Female', label: '>= 15 years, Female' }], required: true }, { name: 'result', label: 'Result', type: 'select', options: [{ value: 'NEG', label: 'Negative' }, { value: 'POS', label: 'Positive' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'MALARIA_TEST', payload: { result: data.result, age_sex_band: data.age_sex_band } }), formatResult: (data) => `Malaria Test — ${data.age_sex_band}, ${data.result}` },
  { id: 'malaria_travel', title: 'Malaria cases with travel history', category: 'Malaria / NTD / NCD', searchTerms: ['malaria', 'travel', 'history'], fields: [], getEvent: () => ({ clinical_event_code: 'MALARIA_TRAVEL_HISTORY', payload: {} }), formatResult: () => `Malaria travel history` },
  { id: 'malaria_phcu', title: 'Malaria cases notified to PHCU', category: 'Malaria / NTD / NCD', searchTerms: ['malaria', 'phcu', 'notified'], fields: [], getEvent: () => ({ clinical_event_code: 'MALARIA_PHCU_NOTIFIED', payload: {} }), formatResult: () => `Malaria PHCU notified` },
  { id: 'malaria_index', title: 'Malaria index cases classified', category: 'Malaria / NTD / NCD', searchTerms: ['malaria', 'index', 'investigated', 'classified'], fields: [], getEvent: () => ({ clinical_event_code: 'MALARIA_INDEX_INVESTIGATED', payload: {} }), formatResult: () => `Malaria index classified` },
  { id: 'leishmaniasis_avail', title: 'Leishmaniasis availability', category: 'Malaria / NTD / NCD', searchTerms: ['leishmaniasis', 'availability', 'treatment', 'available'], fields: [{ name: 'leishmaniasis_treatment', label: 'Leishmaniasis Treatment Available?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'FACILITY_CONFIG', payload: { leishmaniasis_treatment: data.leishmaniasis_treatment === 'true' } }), formatResult: (data) => `Leishmaniasis Availability — ${data.leishmaniasis_treatment === 'true' ? 'Yes' : 'No'}` },
  { id: 'vl_treated', title: 'Visceral Leishmaniasis (VL) Treated', category: 'Malaria / NTD / NCD', searchTerms: ['visceral', 'leishmaniasis', 'vl', 'kala-azar'], fields: [{ name: 'age_sex_band', label: 'Age & Sex Group', type: 'select', options: [{ value: '< 5 years, Male', label: '< 5 years, Male' }, { value: '< 5 years, Female', label: '< 5 years, Female' }, { value: '5 - 14 years, Male', label: '5 - 14 years, Male' }, { value: '5 - 14 years, Female', label: '5 - 14 years, Female' }, { value: '>= 15 years, Male', label: '>= 15 years, Male' }, { value: '>= 15 years, Female', label: '>= 15 years, Female' }], required: true }, { name: 'treatment_type', label: 'Treatment Type', type: 'select', options: [{ value: 'Primary visceral leishmaniasis', label: 'Primary visceral leishmaniasis' }, { value: 'Relapse visceral leishmaniasis', label: 'Relapse visceral leishmaniasis' }, { value: 'Post Kala-azar dermal leishmaniasis (PKDL)', label: 'Post Kala-azar dermal leishmaniasis (PKDL)' }], required: true }, { name: 'treatment_outcome', label: 'Treatment Outcome', type: 'select', options: [{ value: 'Cured', label: 'Cured' }, { value: 'Defaulted', label: 'Defaulted' }, { value: 'Failed', label: 'Failed' }, { value: 'Dead', label: 'Dead' }, { value: 'Referred', label: 'Referred' }], required: true }, { name: 'hiv_status', label: 'HIV Test Result', type: 'select', options: [{ value: 'Positive', label: 'Positive' }, { value: 'Negative', label: 'Negative' }, { value: 'Unknown', label: 'Unknown/Not Tested' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'VL_TREATED', payload: { age_sex_band: data.age_sex_band, treatment_type: data.treatment_type, treatment_outcome: data.treatment_outcome, hiv_status: data.hiv_status } }), formatResult: (data) => `VL Treated — ${data.treatment_type}, ${data.treatment_outcome}` },
  { id: 'cl_treated', title: 'Cutaneous Leishmaniasis (CL) Treated', category: 'Malaria / NTD / NCD', searchTerms: ['cutaneous', 'leishmaniasis', 'cl'], fields: [{ name: 'age_sex_band', label: 'Age & Sex Group', type: 'select', options: [{ value: '< 5 years, Male', label: '< 5 years, Male' }, { value: '< 5 years, Female', label: '< 5 years, Female' }, { value: '5 - 14 years, Male', label: '5 - 14 years, Male' }, { value: '5 - 14 years, Female', label: '5 - 14 years, Female' }, { value: '>= 15 years, Male', label: '>= 15 years, Male' }, { value: '>= 15 years, Female', label: '>= 15 years, Female' }], required: true }, { name: 'treatment_type', label: 'Treatment Type', type: 'select', options: [{ value: 'Primary', label: 'Primary' }, { value: 'Relapse', label: 'Relapse' }], required: true }, { name: 'treatment_outcome', label: 'Treatment Outcome', type: 'select', options: [{ value: 'Cured', label: 'Cured' }, { value: 'Defaulted', label: 'Defaulted' }, { value: 'Failed', label: 'Failed' }, { value: 'Dead', label: 'Dead' }, { value: 'Referred', label: 'Referred' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'CL_TREATED', payload: { age_sex_band: data.age_sex_band, treatment_type: data.treatment_type, treatment_outcome: data.treatment_outcome } }), formatResult: (data) => `CL Treated — ${data.treatment_type}, ${data.treatment_outcome}` },
  { id: 'tt_surgery', title: 'Trachomatous Trichiasis (TT) Surgery', category: 'Malaria / NTD / NCD', searchTerms: ['trachomatous', 'trichiasis', 'tt', 'surgery'], fields: [{ name: 'age_sex_band', label: 'Age & Sex Group', type: 'select', options: [{ value: '< 15 years, Male', label: '< 15 years, Male' }, { value: '< 15 years, Female', label: '< 15 years, Female' }, { value: '>= 15 years, Male', label: '>= 15 years, Male' }, { value: '>= 15 years, Female', label: '>= 15 years, Female' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'TT_SURGERY', payload: { age_sex_band: data.age_sex_band } }), formatResult: (data) => `TT Surgery — ${data.age_sex_band}` },
  { id: 'hydrocele_operated', title: 'Hydrocele Operated', category: 'Malaria / NTD / NCD', searchTerms: ['hydrocele', 'operated', 'lymphatic', 'filariasis'], fields: [{ name: 'age_sex_band', label: 'Age & Sex Group', type: 'select', options: [{ value: '< 15 years, Male', label: '< 15 years, Male' }, { value: '>= 15 years, Male', label: '>= 15 years, Male' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'HYDROCELE_OPERATED', payload: { age_sex_band: data.age_sex_band } }), formatResult: (data) => `Hydrocele Operated — ${data.age_sex_band}` },
  { id: 'lymph_edema_managed', title: 'Lymph Edema Managed', category: 'Malaria / NTD / NCD', searchTerms: ['lymph', 'edema', 'managed', 'podoconiosis', 'filariasis'], fields: [{ name: 'age_sex_band', label: 'Age & Sex Group', type: 'select', options: [{ value: '< 15 years, Male', label: '< 15 years, Male' }, { value: '< 15 years, Female', label: '< 15 years, Female' }, { value: '>= 15 years, Male', label: '>= 15 years, Male' }, { value: '>= 15 years, Female', label: '>= 15 years, Female' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'LYMPH_EDEMA_MANAGED', payload: { age_sex_band: data.age_sex_band } }), formatResult: (data) => `Lymph Edema Managed — ${data.age_sex_band}` },
  { 
    id: 'hypertension', 
    title: 'Hypertension Screening & Enrollment', 
    category: 'Malaria / NTD / NCD', 
    searchTerms: ['hypertension', 'htn', 'blood pressure', 'screening', 'enrollment', 'cohort'], 
    fields: [
      { name: 'age_sex_band', label: 'Age & Sex Group', type: 'select', options: [{ value: '18 - 29 years, Male', label: '18 - 29 years, Male' }, { value: '18 - 29 years, Female', label: '18 - 29 years, Female' }, { value: '30 - 39 years, Male', label: '30 - 39 years, Male' }, { value: '30 - 39 years, Female', label: '30 - 39 years, Female' }, { value: '40 - 69 years, Male', label: '40 - 69 years, Male' }, { value: '40 - 69 years, Female', label: '40 - 69 years, Female' }, { value: '>= 70 years, Male', label: '>= 70 years, Male' }, { value: '>= 70 years, Female', label: '>= 70 years, Female' }], required: true },
      { name: 'screening_done', label: 'Was Hypertension Screening Done?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true },
      { name: 'result', label: 'Screening Result', type: 'select', options: [{ value: 'Normal BP', label: 'Normal BP' }, { value: 'Raised BP', label: 'Raised BP' }], condition: (data) => data.screening_done === 'true', required: true },
      { name: 'enrolled_in_care', label: 'Is patient enrolled in Hypertension Care?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true },
      { name: 'treatment_type', label: 'Treatment Type', type: 'select', options: [{ value: 'Healthy life style counciling (HLC) only', label: 'Healthy life style counciling (HLC) only' }, { value: 'Pharmacological management and HLC', label: 'Pharmacological management and HLC' }], condition: (data) => data.enrolled_in_care === 'true', required: true },
      { name: 'timing', label: 'Timing of Enrollment', type: 'select', options: [{ value: 'Newly enrolled to care', label: 'Newly enrolled to care' }, { value: 'Previously in care', label: 'Previously in care' }], condition: (data) => data.enrolled_in_care === 'true', required: true },
      { name: 'is_6mo_cohort', label: 'Is patient in the 6-month Cohort? (Enrolled 6mo ago)', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true },
      { name: 'cohort_outcome', label: '6-month Cohort Outcome', type: 'select', options: [{ value: 'Retained in care', label: 'Retained in care' }, { value: 'Defaulted / Lost to follow-up', label: 'Defaulted / Lost to follow-up' }, { value: 'Dead', label: 'Dead' }, { value: 'Stopped treatment', label: 'Stopped treatment' }, { value: 'Transferred out', label: 'Transferred out' }], condition: (data) => data.is_6mo_cohort === 'true', required: true }
    ], 
    getEvent: (data) => {
      const events = [];
      if (data.screening_done === 'true') {
        events.push({ clinical_event_code: 'HTN_SCREENED', payload: { age_sex_band: data.age_sex_band, result: data.result } });
      }
      if (data.enrolled_in_care === 'true') {
        events.push({ clinical_event_code: 'HTN_ENROLLED', payload: { age_sex_band: data.age_sex_band, treatment_type: data.treatment_type, timing: data.timing } });
      }
      if (data.is_6mo_cohort === 'true') {
        events.push({ clinical_event_code: 'COHORT_DERIVED', payload: { disease: 'HTN', outcome: data.cohort_outcome } });
      }
      return events;
    }, 
    formatResult: (data) => {
      const parts = [];
      if (data.screening_done === 'true') parts.push(`Screened: ${data.result}`);
      if (data.enrolled_in_care === 'true') parts.push(`Enrolled: ${data.timing}`);
      if (data.is_6mo_cohort === 'true') parts.push(`6mo Cohort: ${data.cohort_outcome}`);
      return `Hypertension — ${parts.join(', ')}`;
    } 
  },
  { 
    id: 'cvd_risk', 
    title: 'Cardiovascular Disease (CVD) Risk', 
    category: 'Malaria / NTD / NCD', 
    searchTerms: ['cvd', 'cardiovascular', 'disease', 'risk', 'heart', 'statin'], 
    fields: [
      { name: 'age_sex_band', label: 'Age & Sex Group', type: 'select', options: [{ value: '40 - 59 Years, Male', label: '40 - 59 Years, Male' }, { value: '40 - 59 Years, Female', label: '40 - 59 Years, Female' }, { value: '60 - 74 Years, Male', label: '60 - 74 Years, Male' }, { value: '60 - 74 Years, Female', label: '60 - 74 Years, Female' }], required: true },
      { name: 'risk_category', label: 'Risk Category', type: 'select', options: [{ value: 'Lab based risk category (>=20%)', label: 'Lab based risk category (>=20%)' }, { value: 'Non-Lab based category (>=10%)', label: 'Non-Lab based category (>=10%)' }], required: true },
      { name: 'received_treatment', label: 'Did the patient receive treatment?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true },
      { name: 'treatment_type', label: 'Treatment Type', type: 'select', options: [{ value: 'With Statin', label: 'With Statin' }, { value: 'Without Statin', label: 'Without Statin' }], condition: (data) => data.received_treatment === 'true', required: true }
    ], 
    getEvent: (data) => {
      const events = [];
      events.push({ clinical_event_code: 'CVD_RISK_ASSESSMENT', payload: { age_sex_band: data.age_sex_band, risk_category: data.risk_category } });
      if (data.received_treatment === 'true') {
        events.push({ clinical_event_code: 'CVD_RISK_TREATED', payload: { age_sex_band: data.age_sex_band, treatment_type: data.treatment_type } });
      }
      return events;
    }, 
    formatResult: (data) => {
      const parts = [`Category: ${data.risk_category}`];
      if (data.received_treatment === 'true') parts.push(`Treatment: ${data.treatment_type}`);
      return `CVD Risk — ${parts.join(', ')}`;
    } 
  },
  { 
    id: 'diabetes', 
    title: 'Diabetes Mellitus (DM) Screening & Enrollment', 
    category: 'Malaria / NTD / NCD', 
    searchTerms: ['diabetes', 'dm', 'sugar', 'screening', 'enrollment', 'cohort'], 
    fields: [
      { name: 'screening_done', label: 'Was Diabetes Screening Done?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true },
      { name: 'screening_age_sex_band', label: 'Screening Age & Sex Group', type: 'select', options: [{ value: '< 40 years, Male', label: '< 40 years, Male' }, { value: '< 40 years, Female', label: '< 40 years, Female' }, { value: '>= 40 years, Male', label: '>= 40 years, Male' }, { value: '>= 40 years, Female', label: '>= 40 years, Female' }], condition: (data) => data.screening_done === 'true', required: true },
      { name: 'result', label: 'Screening Result', type: 'select', options: [{ value: 'Normal blood sugar', label: 'Normal blood sugar' }, { value: 'Raised blood sugar', label: 'Raised blood sugar' }], condition: (data) => data.screening_done === 'true', required: true },
      { name: 'enrolled_in_care', label: 'Is patient enrolled in Diabetes Care?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true },
      { name: 'enrollment_age_sex_band', label: 'Enrollment Age & Sex Group', type: 'select', options: [{ value: '< 15 years, Male', label: '< 15 years, Male' }, { value: '< 15 years, Female', label: '< 15 years, Female' }, { value: '15 - 29 years, Male', label: '15 - 29 years, Male' }, { value: '15 - 29 years, Female', label: '15 - 29 years, Female' }, { value: '30 - 39 years, Male', label: '30 - 39 years, Male' }, { value: '30 - 39 years, Female', label: '30 - 39 years, Female' }, { value: '>= 40 years, Male', label: '>= 40 years, Male' }, { value: '>= 40 years, Female', label: '>= 40 years, Female' }], condition: (data) => data.enrolled_in_care === 'true', required: true },
      { name: 'diabetes_type', label: 'Type of Diabetes', type: 'select', options: [{ value: 'Type I', label: 'Type I' }, { value: 'Type II', label: 'Type II' }, { value: 'Gestational DM', label: 'Gestational DM' }], condition: (data) => data.enrolled_in_care === 'true', required: true },
      { name: 'treatment_type', label: 'Treatment Type', type: 'select', options: [{ value: 'Healthy life style counciling (HLC) only', label: 'Healthy life style counciling (HLC) only' }, { value: 'Pharmacological management and HLC', label: 'Pharmacological management and HLC' }], condition: (data) => data.enrolled_in_care === 'true', required: true },
      { name: 'timing', label: 'Timing of Enrollment', type: 'select', options: [{ value: 'Newly enrolled to care', label: 'Newly enrolled to care' }, { value: 'Previously in care', label: 'Previously in care' }], condition: (data) => data.enrolled_in_care === 'true', required: true },
      { name: 'is_6mo_cohort', label: 'Is patient in the 6-month Cohort? (Enrolled 6mo ago)', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true },
      { name: 'cohort_outcome', label: '6-month Cohort Treatment Outcome', type: 'select', options: [{ value: 'Controlled', label: 'Controlled' }, { value: 'Uncontrolled', label: 'Uncontrolled' }, { value: 'Lost to follow-up', label: 'Lost to follow-up' }, { value: 'Died', label: 'Died' }, { value: 'Transferred out', label: 'Transferred out' }, { value: 'Not evaluated', label: 'Not evaluated' }], condition: (data) => data.is_6mo_cohort === 'true', required: true },
      { name: 'cohort_age_sex_band', label: '6-month Cohort Age & Sex Group', type: 'select', options: [{ value: '< 15 years, Male', label: '< 15 years, Male' }, { value: '< 15 years, Female', label: '< 15 years, Female' }, { value: '15 - 29 years, Male', label: '15 - 29 years, Male' }, { value: '15 - 29 years, Female', label: '15 - 29 years, Female' }, { value: '30 - 39 years, Male', label: '30 - 39 years, Male' }, { value: '30 - 39 years, Female', label: '30 - 39 years, Female' }, { value: '>= 40 years, Male', label: '>= 40 years, Male' }, { value: '>= 40 years, Female', label: '>= 40 years, Female' }], condition: (data) => data.is_6mo_cohort === 'true', required: true }
    ], 
    getEvent: (data) => {
      const events = [];
      if (data.screening_done === 'true') {
        events.push({ clinical_event_code: 'DM_SCREENED', payload: { age_sex_band: data.screening_age_sex_band, result: data.result } });
      }
      if (data.enrolled_in_care === 'true') {
        events.push({ clinical_event_code: 'DM_ENROLLED', payload: { age_sex_band: data.enrollment_age_sex_band, diabetes_type: data.diabetes_type, treatment_type: data.treatment_type, timing: data.timing } });
      }
      if (data.is_6mo_cohort === 'true') {
        events.push({ clinical_event_code: 'COHORT_DERIVED', payload: { disease: 'DM', age_sex_band: data.cohort_age_sex_band, outcome: data.cohort_outcome } });
      }
      return events;
    }, 
    formatResult: (data) => {
      const parts = [];
      if (data.screening_done === 'true') parts.push(`Screened: ${data.result}`);
      if (data.enrolled_in_care === 'true') parts.push(`Enrolled: ${data.diabetes_type}`);
      if (data.is_6mo_cohort === 'true') parts.push(`6mo Cohort: ${data.cohort_outcome}`);
      return `Diabetes — ${parts.join(', ')}`;
    } 
  },
  { 
    id: 'cervical_ca', 
    title: 'Cervical Cancer Screening & Follow-up', 
    category: 'Malaria / NTD / NCD', 
    searchTerms: ['cervical', 'cancer', 'ca', 'via', 'hpv', 'cryotherapy', 'leep'], 
    fields: [
      { name: 'screening_done', label: 'Was Cervical Cancer Screening Done?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true },
      { name: 'screening_type', label: 'Screening Type', type: 'select', options: [{ value: 'Screened by VIA', label: 'Screened by VIA' }, { value: 'Screened by HPV DNA', label: 'Screened by HPV DNA' }], condition: (data) => data.screening_done === 'true', required: true },
      { name: 'via_result', label: 'VIA Screening Result', type: 'select', options: [{ value: 'Negative', label: 'Negative' }, { value: 'Positive: Eligible for Cryotherapy/thermocoagulation', label: 'Positive: Eligible for Cryotherapy/thermocoagulation' }, { value: 'Positive: not eligible for Cryotherapy/thermocoagulation', label: 'Positive: not eligible for Cryotherapy/thermocoagulation' }, { value: 'Suspicious cancerous lesion', label: 'Suspicious cancerous lesion' }], condition: (data) => data.screening_done === 'true' && data.screening_type === 'Screened by VIA', required: true },
      { name: 'hpv_result', label: 'HPV/DNA Screening Result', type: 'select', options: [{ value: 'Positive', label: 'Positive' }, { value: 'Negative', label: 'Negative' }], condition: (data) => data.screening_done === 'true' && data.screening_type === 'Screened by HPV DNA', required: true },
      
      { name: 'received_treatment', label: 'Did the patient receive treatment?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true },
      { name: 'treatment_type', label: 'Treatment Type', type: 'select', options: [{ value: 'Cryotherapy', label: 'Cryotherapy' }, { value: 'LEEP', label: 'LEEP' }, { value: 'Thermal Abrasion/Thermocoagulation', label: 'Thermal Abrasion/Thermocoagulation' }], condition: (data) => data.received_treatment === 'true', required: true },
      
      { name: 'is_1yr_followup', label: 'Is this a 1-year Follow-up?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true },
      { name: 'followup_screening_type', label: 'Follow-up Screening Type', type: 'select', options: [{ value: 'Screened by VIA', label: 'Screened by VIA' }, { value: 'Screened by HPV DNA', label: 'Screened by HPV DNA' }], condition: (data) => data.is_1yr_followup === 'true', required: true },
      { name: 'followup_via_result', label: 'Follow-up VIA Result', type: 'select', options: [{ value: 'Negative', label: 'Negative' }, { value: 'Positive: Eligible for Cryotherapy/thermocoagulation', label: 'Positive: Eligible for Cryotherapy/thermocoagulation' }, { value: 'Positive: not eligible for Cryotherapy/thermocoagulation', label: 'Positive: not eligible for Cryotherapy/thermocoagulation' }, { value: 'Suspicious cancerous lesion', label: 'Suspicious cancerous lesion' }], condition: (data) => data.is_1yr_followup === 'true' && data.followup_screening_type === 'Screened by VIA', required: true },
      { name: 'followup_hpv_result', label: 'Follow-up HPV/DNA Result', type: 'select', options: [{ value: 'Positive', label: 'Positive' }, { value: 'Negative', label: 'Negative' }], condition: (data) => data.is_1yr_followup === 'true' && data.followup_screening_type === 'Screened by HPV DNA', required: true }
    ], 
    getEvent: (data) => {
      const events = [];
      if (data.screening_done === 'true') {
        events.push({ clinical_event_code: 'CERVICAL_CA_SCREENED', payload: { screening_type: data.screening_type } });
        if (data.screening_type === 'Screened by VIA') {
          events.push({ clinical_event_code: 'CERVICAL_CA_VIA_RESULT', payload: { result: data.via_result } });
        } else if (data.screening_type === 'Screened by HPV DNA') {
          events.push({ clinical_event_code: 'CERVICAL_CA_HPV_RESULT', payload: { result: data.hpv_result } });
        }
      }
      if (data.received_treatment === 'true') {
        events.push({ clinical_event_code: 'CERVICAL_CA_TREATED', payload: { treatment_type: data.treatment_type } });
      }
      if (data.is_1yr_followup === 'true') {
        events.push({ 
          clinical_event_code: 'CERVICAL_CA_FOLLOWUP', 
          payload: { 
            screening_type: data.followup_screening_type,
            via_result: data.followup_screening_type === 'Screened by VIA' ? data.followup_via_result : undefined,
            hpv_result: data.followup_screening_type === 'Screened by HPV DNA' ? data.followup_hpv_result : undefined
          }
        });
      }
      return events;
    }, 
    formatResult: (data) => {
      const parts = [];
      if (data.screening_done === 'true') parts.push(`Screened: ${data.screening_type}`);
      if (data.received_treatment === 'true') parts.push(`Treated: ${data.treatment_type}`);
      if (data.is_1yr_followup === 'true') parts.push(`1yr Follow-up`);
      return `Cervical CA — ${parts.join(', ')}`;
    } 
  },
  { 
    id: 'cataract', 
    title: 'Cataract Surgery', 
    category: 'Malaria / NTD / NCD', 
    searchTerms: ['cataract', 'surgery', 'eye', 'vision'], 
    fields: [
      { name: 'surgery_performed', label: 'Was Cataract Surgery Performed?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true }
    ], 
    getEvent: (data) => {
      if (data.surgery_performed === 'true') {
        return [{ clinical_event_code: 'CATARACT_SURGERY', payload: {} }];
      }
      return [];
    }, 
    formatResult: (data) => `Cataract Surgery Performed` 
  },
  
  // Other Clinical Services
  { id: 'notifiable_disease', title: 'Notifiable Disease / PHEM Case', category: 'Other Clinical Services', searchTerms: ['measles', 'cholera', 'polio', 'anthrax', 'rabies', 'covid', 'dengue', 'phem'], fields: [{ name: 'disease', label: 'Disease', type: 'select', options: [{ value: 'MEASLES', label: 'Measles' }, { value: 'CHOLERA', label: 'Cholera' }, { value: 'RABIES', label: 'Rabies Exposure' }, { value: 'COVID', label: 'COVID-19' }, { value: 'DENGUE', label: 'Dengue Fever' }], required: true }], getEvent: (data) => ({ clinical_event_code: `NOTIFIABLE_DISEASE_${data.disease}`, payload: {} }), formatResult: (data, code) => `Notifiable Disease — ${code}` },
  
  // Medical Services & Emergency
  { id: 'amb_dispatched_tech', title: 'Ambulance Dispatched (Tech)', category: 'Medical Services & Emergency', searchTerms: ['ambulance', 'dispatched', 'tech', 'emt'], fields: [{ name: 'dispatched_tech', label: 'Dispatched with EMT?', type: 'select', options: [{ value: 'With Emergency Medical Technicians (EMT)', label: 'With EMT' }, { value: 'Without Emergency Medical Technicians (EMT)', label: 'Without EMT' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'FACILITY_INPUT', payload: { dispatched_tech: data.dispatched_tech } }), formatResult: (data) => `Ambulance Dispatched — ${data.dispatched_tech}` },
  { id: 'amb_requests', title: 'Ambulance Requests', category: 'Medical Services & Emergency', searchTerms: ['ambulance', 'request'], fields: [], getEvent: () => ({ clinical_event_code: 'AMBULANCE_REQUEST', payload: {} }), formatResult: () => `Ambulance Request` },
  { id: 'amb_dispatched_case', title: 'Ambulance Dispatched (Case)', category: 'Medical Services & Emergency', searchTerms: ['ambulance', 'dispatched', 'case', 'labor', 'rta', 'trauma'], fields: [{ name: 'case_type', label: 'Case Type', type: 'select', options: [{ value: 'Labor & Obstetrics Emergency', label: 'Labor & Obstetrics Emergency' }, { value: 'Road Traffic Accident', label: 'Road Traffic Accident' }, { value: 'Trauma', label: 'Trauma' }, { value: 'Burn & Poisoning', label: 'Burn & Poisoning' }, { value: 'Others', label: 'Others' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'AMBULANCE_DISPATCH', payload: { case_type: data.case_type } }), formatResult: (data) => `Ambulance Case — ${data.case_type}` },
  { id: 'er_deaths', title: 'ER Deaths', category: 'Medical Services & Emergency', searchTerms: ['er', 'emergency', 'death', 'died'], fields: [{ name: 'hours_stay', label: 'Hours of Stay before death', type: 'select', options: [{ value: '0', label: '< 24 hours' }, { value: '25', label: '>= 24 hours' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'ER_DEATH', payload: { hours_stay: parseInt(data.hours_stay) } }), formatResult: (data) => `ER Death (${data.hours_stay === '0' ? '< 24' : '>= 24'} hrs)` },
  { id: 'er_attendance', title: 'ER Attendance', category: 'Medical Services & Emergency', searchTerms: ['er', 'emergency', 'attendance', 'visit'], fields: [{ name: 'hours_stay', label: 'Hours of Stay in ER', type: 'select', options: [{ value: '0', label: '< 24 hours' }, { value: '25', label: '>= 24 hours' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'ER_ATTENDANCE', payload: { hours_stay: parseInt(data.hours_stay) } }), formatResult: (data) => `ER Attendance (${data.hours_stay === '0' ? '< 24' : '>= 24'} hrs)` },
  { id: 'er_discharge', title: 'ER Discharges', category: 'Medical Services & Emergency', searchTerms: ['er', 'emergency', 'discharge'], fields: [], getEvent: () => ({ clinical_event_code: 'ER_DISCHARGE', payload: {} }), formatResult: () => `ER Discharge` },
  { id: 'ip_admission', title: 'Inpatient Admissions', category: 'Medical Services & Emergency', searchTerms: ['inpatient', 'admission', 'admitted'], fields: [], getEvent: () => ({ clinical_event_code: 'INPATIENT_ADMISSION', payload: {} }), formatResult: () => `Inpatient Admission` },
  { id: 'ip_death', title: 'Inpatient Deaths', category: 'Medical Services & Emergency', searchTerms: ['inpatient', 'death', 'died'], fields: [{ name: 'hours_stay', label: 'Hours of Stay before death', type: 'select', options: [{ value: '0', label: '< 24 hours' }, { value: '25', label: '>= 24 hours' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'INPATIENT_DEATH', payload: { hours_stay: parseInt(data.hours_stay) } }), formatResult: (data) => `Inpatient Death (${data.hours_stay === '0' ? '< 24' : '>= 24'} hrs)` },
  { id: 'blood_received', title: 'Blood Units Received', category: 'Medical Services & Emergency', searchTerms: ['blood', 'units', 'received', 'bank'], fields: [{ name: 'units', label: 'Units Received', type: 'number', required: true }], getEvent: (data) => ({ clinical_event_code: 'FACILITY_INPUT', payload: { units: parseInt(data.units) } }), formatResult: (data) => `Blood Received — ${data.units} units` },
  { id: 'blood_transfused', title: 'Blood Units Transfused', category: 'Medical Services & Emergency', searchTerms: ['blood', 'units', 'transfused', 'transfusion'], fields: [{ name: 'transfusion_type', label: 'Transfusion Type', type: 'select', options: [{ value: 'Direct family replacement', label: 'Direct family replacement' }, { value: 'From blood bank', label: 'From blood bank' }], required: true }], getEvent: (data) => ({ clinical_event_code: 'BLOOD_TRANSFUSION', payload: { transfusion_type: data.transfusion_type } }), formatResult: (data) => `Blood Transfused — ${data.transfusion_type}` },
  { id: 'transfusion_reaction', title: 'Transfusion Reactions', category: 'Medical Services & Emergency', searchTerms: ['transfusion', 'reaction', 'adverse'], fields: [], getEvent: () => ({ clinical_event_code: 'TRANSFUSION_REACTION', payload: {} }), formatResult: () => `Transfusion Reaction` },
  { id: 'road_traffic', title: 'Road traffic injury', category: 'Medical Services & Emergency', searchTerms: ['rta', 'road', 'traffic', 'injury', 'accident'], fields: [{ name: 'accident_type', label: 'Accident Type', type: 'select', options: [{ value: 'Vehicle occupant', label: 'Vehicle occupant' }, { value: 'Motor cyclist', label: 'Motor cyclist' }, { value: 'Pedestrian', label: 'Pedestrian' }, { value: 'Others', label: 'Others' }], required: true }], getEvent: (data) => ({ clinical_event_code: `ROAD_TRAFFIC_INJURY`, payload: { accident_type: data.accident_type } }), formatResult: (data) => `Road traffic injury — ${data.accident_type}` }
].map(item => ({ ...item, reportType: ['HMIS'] }));

// Make maternal death and notifiable diseases applicable to PHEM
const matDeath = CLINICAL_OCCURRENCES.find(i => i.id === 'maternal_death')
if (matDeath) matDeath.reportType = ['HMIS', 'PHEM']

const notifDis = CLINICAL_OCCURRENCES.find(i => i.id === 'notifiable_disease')
if (notifDis) notifDis.reportType = ['HMIS', 'PHEM']

CLINICAL_OCCURRENCES.push(
  // PHEM Page 1
  { id: 'phem_afp', title: 'AFP/polio Case Record', category: 'Immediately Notifiable', reportType: ['PHEM'], searchTerms: ['afp', 'polio'], fields: [], getEvent: () => ({ clinical_event_code: 'NOTIFIABLE_DISEASE_AFP', payload: {} }), formatResult: () => 'AFP/polio Case' },
  { id: 'phem_anthrax', title: 'Anthrax Case Record', category: 'Immediately Notifiable', reportType: ['PHEM'], searchTerms: ['anthrax'], fields: [], getEvent: () => ({ clinical_event_code: 'NOTIFIABLE_DISEASE_ANTHRAX', payload: {} }), formatResult: () => 'Anthrax Case' },
  { id: 'phem_chikungunya', title: 'Chikungunya Case Record', category: 'Immediately Notifiable', reportType: ['PHEM'], searchTerms: ['chikungunya'], fields: [], getEvent: () => ({ clinical_event_code: 'NOTIFIABLE_DISEASE_CHIKUNGUNYA', payload: {} }), formatResult: () => 'Chikungunya Case' },
  { id: 'phem_dengue', title: 'Dengue Fever Case Record', category: 'Immediately Notifiable', reportType: ['PHEM'], searchTerms: ['dengue', 'fever', 'douge'], fields: [], getEvent: () => ({ clinical_event_code: 'NOTIFIABLE_DISEASE_DENGUE', payload: {} }), formatResult: () => 'Dengue Fever Case' },
  { id: 'phem_perinatal_death', title: 'Perinatal Death Record', category: 'Immediately Notifiable', reportType: ['PHEM'], searchTerms: ['perinatal', 'death'], fields: [], getEvent: () => ({ clinical_event_code: 'PERINATAL_DEATH_RECORD', payload: {} }), formatResult: () => 'Perinatal Death Record' },
  
  { 
    id: 'phem_malaria', 
    title: 'Malaria cases', 
    category: 'Weekly Disease Summary', 
    reportType: ['PHEM'], 
    searchTerms: ['malaria'], 
    fields: [
      { name: 'tested', label: 'Was the patient tested for Malaria?', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }], required: true },
      { name: 'method', label: 'Test Method', type: 'select', options: [{ value: 'RDT', label: 'RDT' }, { value: 'MICROSCOPY', label: 'Microscopy' }], condition: (data) => data.tested === 'true', required: true },
      { name: 'result', label: 'Test Result', type: 'select', options: [{ value: 'POS', label: 'Positive' }, { value: 'NEG', label: 'Negative' }], condition: (data) => data.tested === 'true', required: true },
      { name: 'parasite', label: 'Parasite Species', type: 'select', options: [{ value: 'PF', label: 'P. falciparum / Mixed' }, { value: 'PV', label: 'P. vivax' }], condition: (data) => data.result === 'POS', required: true }
    ], 
    getEvent: (data) => {
      const events = [];
      events.push({ clinical_event_code: 'MALARIA_CASE_RECORD', payload: {} });
      if (data.tested === 'true') {
        events.push({ 
          clinical_event_code: 'MALARIA_TEST', 
          payload: { 
            method: data.method,
            result: data.result,
            parasite: data.result === 'POS' ? data.parasite : undefined
          } 
        });
      }
      return events;
    }, 
    formatResult: (data) => {
      if (data.tested === 'true') {
        return `Malaria Case (${data.method}: ${data.result}${data.result === 'POS' ? ' - ' + data.parasite : ''})`;
      }
      return 'Malaria Case (Not Tested)';
    } 
  },
  { id: 'phem_meningitis', title: 'Meningitis Episode', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['meningitis'], fields: [], getEvent: () => ({ clinical_event_code: 'DISEASE_MENINGITIS', payload: {} }), formatResult: () => 'Meningitis Episode' },
  { id: 'phem_dysentery', title: 'Dysentery Episode', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['dysentery'], fields: [], getEvent: () => ({ clinical_event_code: 'DISEASE_DYSENTERY', payload: {} }), formatResult: () => 'Dysentery Episode' },
  { id: 'phem_sam_u5', title: 'Severe Acute Malnutrition (SAM) <5', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['severe acute malnutrition', 'sam'], fields: [], getEvent: () => ({ clinical_event_code: 'NUTRITION_SAM_U5', payload: {} }), formatResult: () => 'SAM <5' },
  { id: 'phem_mam_u5', title: 'Moderate Acute Malnutrition (MAM) <5', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['moderate acute malnutrition', 'mam'], fields: [], getEvent: () => ({ clinical_event_code: 'NUTRITION_MAM_U5', payload: {} }), formatResult: () => 'MAM <5' },
  { id: 'phem_mam_plw', title: 'MAM PLW (Pregnant/Lactating Women)', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['mam', 'plw', 'pregnant', 'lactating'], fields: [], getEvent: () => ({ clinical_event_code: 'NUTRITION_MAM_PLW', payload: {} }), formatResult: () => 'MAM PLW' },
  { id: 'phem_diarrhea', title: 'Diarrhea w/ dehydration <5', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['diarrhea', 'dehydration'], fields: [], getEvent: () => ({ clinical_event_code: 'DIARRHEA_DEHYDRATION_U5', payload: {} }), formatResult: () => 'Diarrhea <5' },
  { id: 'phem_jaundice', title: 'Acute Jaundice Syndrome <14d', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['jaundice', 'acute'], fields: [], getEvent: () => ({ clinical_event_code: 'ACUTE_JAUNDICE_SYNDROME', payload: {} }), formatResult: () => 'Acute Jaundice' },
  { id: 'phem_pneumonia', title: 'Severe Pneumonia <5', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['pneumonia', 'severe'], fields: [], getEvent: () => ({ clinical_event_code: 'SEVERE_PNEUMONIA_U5', payload: {} }), formatResult: () => 'Severe Pneumonia <5' },
  { id: 'phem_diabetes_new', title: 'Diabetes new cases', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['diabetes', 'dm', 'new'], fields: [], getEvent: () => ({ clinical_event_code: 'DM_ENROLLED', payload: {} }), formatResult: () => 'Diabetes new case' },
  { id: 'phem_hiv_new', title: 'HIV new cases', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['hiv', 'new'], fields: [], getEvent: () => ({ clinical_event_code: 'HIV_NEW_CASE', payload: {} }), formatResult: () => 'HIV new case' },
  { id: 'phem_tb_new', title: 'Tuberculosis new cases', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['tuberculosis', 'tb', 'new'], fields: [], getEvent: () => ({ clinical_event_code: 'TB_ENROLLED', payload: {} }), formatResult: () => 'Tuberculosis new case' },
  { id: 'phem_htn_new', title: 'Hypertension new cases', category: 'Weekly Disease Summary', reportType: ['PHEM'], searchTerms: ['hypertension', 'htn', 'new'], fields: [], getEvent: () => ({ clinical_event_code: 'HTN_ENROLLED', payload: {} }), formatResult: () => 'Hypertension new case' }
);

export default function GovernmentReporting({ patientId, patient, visits, reportType = 'HMIS' }) {
  const { user: me } = useAuth()
  const myRole = me?.role?.name ?? me?.role
  const canEdit = ['doctor', 'nurse', 'admin'].includes(myRole)

  const activeTab = reportType
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  
  // Manage expandable categories
  const [expandedCategories, setExpandedCategories] = useState({
    'Reproductive & Maternal Health': true,
    'Neonatal & Child Health': true,
    'Nutrition': true,
    'Malaria / NTD / NCD': true,
    'Other Clinical Services': true,
    'Medical Services & Emergency': true,
    'Immediately Notifiable': true,
    'Weekly Disease Summary': true
  })

  const activeEncounterId = visits?.[0]?.id

  const [catalogItems, setCatalogItems] = useState([])

  const loadEventsAndCatalog = async () => {
    setLoading(true)
    try {
      const [eventsRes, catalogRes] = await Promise.all([
        reportsApi.searchEvents({ patient_id: patientId, encounter_id: activeEncounterId }),
        reportsApi.getEventCatalog()
      ])
      setEvents(eventsRes.data.items || [])
      setCatalogItems(catalogRes.data || [])
    } catch (err) {
      toast.error('Failed to load clinical occurrences or catalog')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (patientId) loadEventsAndCatalog()
  }, [patientId, activeEncounterId])

  const formatEventForUI = (e) => {
    if (e.source === 'CLINICIAN') {
      const match = CLINICAL_OCCURRENCES.find(occ => {
        try {
          const fakeData = e.payload || {}
          const testPayload = occ.getEvent(fakeData)
          if (occ.id === 'delivery_outcome') return e.code === 'DELIVERY_RECORD'
          if (occ.id === 'notifiable_disease') return e.code.startsWith('NOTIFIABLE_DISEASE_')
          if (occ.id === 'malaria_manual') return e.code.startsWith('MALARIA_')
          if (occ.id === 'road_traffic') return e.code.startsWith('ROAD_TRAFFIC_INJURY')
          if (occ.id === 'vita_supp') return e.code.startsWith('VITA_SUPP')
          return testPayload.clinical_event_code === e.code
        } catch { return false }
      })
      if (match) {
        try {
          return match.formatResult(e.payload || {}, e.code)
        } catch { return `${match.title}` }
      }
      return `${e.code}`
    }
    if (e.source === 'AUTOMATIC') {
      return `[Automated via ${e.source_record_type}] ${e.code}`
    }
    return e.code
  }

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
    setSelectedItem(null)
  }

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))
  }

  // Group occurrences by category, filtering by search term if active
  const groupedOccurrences = useMemo(() => {
    const grouped = {}
    const lower = searchTerm.toLowerCase().trim()

    // Process all explicit frontend configs first
    const processedBackendCodes = new Set()
    
    CLINICAL_OCCURRENCES.forEach(config => {
      // 1. Check if the active tab matches (PHEM vs HMIS)
      if (!config.reportType.includes(activeTab)) return;

      let backendCode = 'UNKNOWN'
      try {
        backendCode = config.getEvent({}).clinical_event_code || 'UNKNOWN'
      } catch (e) {
        // Parameterized events might throw, that's fine
      }
      
      const item = {
        ...config,
        title: config.title,
        backendCode
      }

      const titleLower = item.title.toLowerCase()
      const matchesSearch = !searchTerm || 
        titleLower.includes(lower) || 
        lower.includes(titleLower) ||
        item.category.toLowerCase().includes(lower) || 
        item.searchTerms.some(t => t.includes(lower) || lower.includes(t))
        
      if (matchesSearch) {
        if (!grouped[item.category]) grouped[item.category] = []
        grouped[item.category].push(item)
      }
      
      processedBackendCodes.add(backendCode)
    })

    // Process any remaining backend catalog items not covered by explicit config
    catalogItems.forEach(catalogItem => {
      if (processedBackendCodes.has(catalogItem.code)) return

      // Logic to separate HMIS vs PHEM based on backend category
      const isPhem = catalogItem.category && catalogItem.category.startsWith('PHEM');
      if (activeTab === 'PHEM' && !isPhem) return;
      if (activeTab === 'HMIS' && isPhem) return;
      
      const item = {
        id: catalogItem.code,
        title: catalogItem.title,
        category: catalogItem.category || 'Other',
        searchTerms: [catalogItem.title.toLowerCase()],
        fields: [],
        getEvent: () => ({ clinical_event_code: catalogItem.code, payload: {} }),
        formatResult: () => catalogItem.title,
        backendCode: catalogItem.code
      }

      const titleLower = item.title.toLowerCase()
      const matchesSearch = !searchTerm || 
        titleLower.includes(lower) || 
        lower.includes(titleLower) ||
        item.category.toLowerCase().includes(lower)
        
      if (matchesSearch) {
        if (!grouped[item.category]) grouped[item.category] = []
        grouped[item.category].push(item)
      }
    })
    
    return grouped
  }, [searchTerm, catalogItems, activeTab])

  if (loading) return <div className="loading-center" style={{ padding: '2rem' }}><Activity className="spinning" size={24} /></div>

  return (
    <div className="gov-reporting-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={18} /> Government Reporting
        </h4>
      </div>

      {/* Patient Context Panel */}
      {patient && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1.5rem' }}>
          <div><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Patient</span><div style={{ fontWeight: 600 }}>{patient.first_name_en} {patient.last_name_en}</div></div>
          <div><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Age</span><div style={{ fontWeight: 600 }}>{patient.date_of_birth ? Math.floor((new Date() - new Date(patient.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)) + ' yrs' : 'N/A'}</div></div>
          <div><span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Sex</span><div style={{ fontWeight: 600 }}>{patient.gender === 'F' ? 'Female' : patient.gender === 'M' ? 'Male' : patient.gender}</div></div>
        </div>
      )}

      {/* Reported Events block */}
      <div className="reported-events-list" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
        <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Reported during this visit</h5>
        {events.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: '0' }}>None</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {events.map((e, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--color-green)' }} />
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{formatEventForUI(e)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-card)' }}>
          
          {/* Always visible header/search bar */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: selectedItem ? '1px solid var(--border)' : 'none', background: 'var(--bg-subtle)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '0.75rem' }} />
            <input 
              type="text" 
              placeholder="Search reportable event (e.g., ANC, hypertension, contraceptive...)" 
              value={searchTerm}
              onChange={handleSearchChange}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '0.95rem' }}
            />
            {searchTerm && (
              <button className="btn btn-ghost btn-xs btn-icon" onClick={() => { setSearchTerm(''); setSelectedItem(null); }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Render selected form inline OR the categorized list */}
          {selectedItem ? (
            <ClinicalEventForm 
              item={selectedItem} 
              patientId={patientId}
              encounterId={activeEncounterId}
              events={events}
              onSaved={() => {
                setSelectedItem(null)
                setSearchTerm('')
                loadEventsAndCatalog()
              }}
              onCancel={() => setSelectedItem(null)}
            />
          ) : (
            <div style={{ maxHeight: '450px', overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
              <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface)' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Reportable Clinical Events</h5>
              </div>
              
              {Object.keys(groupedOccurrences).length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No matching clinical occurrences found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {Object.entries(groupedOccurrences).map(([category, items]) => (
                    <div key={category} className="catalog-category" style={{ borderTop: '1px solid var(--border)' }}>
                      <div 
                        onClick={() => toggleCategory(category)}
                        className="hover-bg-subtle"
                        style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', background: 'var(--bg-subtle)' }}
                      >
                        {expandedCategories[category] || searchTerm ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        {category}
                      </div>
                      
                      {(expandedCategories[category] || searchTerm) && (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {items.map(occ => (
                            <li 
                              key={occ.id}
                              style={{ padding: '0.65rem 1rem 0.65rem 2.5rem', borderTop: '1px solid var(--border-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--color-primary)' }}
                              onClick={() => setSelectedItem(occ)}
                              className="hover-bg-subtle"
                            >
                              <Plus size={14} style={{ marginRight: '0.5rem' }} /> {occ.title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ClinicalEventForm({ item, patientId, encounterId, events, onSaved, onCancel }) {
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)

  const isDuplicate = events.some(e => {
    try {
      const generated = item.getEvent(formData)
      const toCheck = Array.isArray(generated) ? generated : [generated]
      return toCheck.some(g => e.code.startsWith(g.clinical_event_code.split('_')[0]) && e.code === g.clinical_event_code)
    } catch { return false }
  })

  const handleChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }))

  const handleRecord = async () => {
    for (const field of item.fields) {
      if (field.condition && !field.condition(formData)) continue;
      if (field.required && !formData[field.name]) {
        toast.error(`${field.label} is required`)
        return
      }
    }
    setSaving(true)
    try {
      const backendEvents = item.getEvent(formData)
      const eventsToSave = Array.isArray(backendEvents) ? backendEvents : [backendEvents]
      if (eventsToSave.length === 0) {
        toast.error('Nothing to record based on your selections.')
        setSaving(false)
        return
      }
      for (const backendEvent of eventsToSave) {
        await reportsApi.createEvent({ patient_id: patientId, encounter_id: encounterId, clinical_event_code: backendEvent.clinical_event_code, payload: backendEvent.payload })
      }
      toast.success('Event recorded')
      onSaved()
    } catch (err) {
      toast.error(apiError(err, 'Failed to record event'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '1.25rem', background: 'var(--bg-surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
           <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>{item.category}</span>
           <h5 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.title}</h5>
        </div>
        {isDuplicate && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-warning)', fontSize: '0.8rem', fontWeight: 600 }}>
            <CheckCircle2 size={14} /> Already reported during this visit
          </span>
        )}
      </div>

      {item.fields.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {item.fields.map(field => {
            if (field.condition && !field.condition(formData)) return null;
            return (
            <div key={field.name}>
              {field.type !== 'checkbox' && <label className="form-label" style={{ display: 'block', marginBottom: '0.4rem' }}>{field.label}</label>}
              {field.type === 'select' ? (
                <select className="form-input" value={formData[field.name] || ''} onChange={e => handleChange(field.name, e.target.value)}>
                  <option value="" disabled>Select {field.label.toLowerCase()}</option>
                  {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              ) : field.type === 'checkbox' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input type="checkbox" checked={!!formData[field.name]} onChange={e => handleChange(field.name, e.target.checked)} style={{ width: '1.25rem', height: '1.25rem' }} />
                  <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{field.label}</span>
                </div>
              ) : (
                <input type={field.type} className="form-input" value={formData[field.name] || ''} onChange={e => handleChange(field.name, e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}`} />
              )}
            </div>
            )
          })}
        </div>
      )}

      {item.fields.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>No additional details required. Click Record to save.</p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-start' }}>
        <button className="btn btn-primary" onClick={handleRecord} disabled={saving}>{saving ? 'Recording...' : 'Record Event'}</button>
        <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </div>
  )
}
