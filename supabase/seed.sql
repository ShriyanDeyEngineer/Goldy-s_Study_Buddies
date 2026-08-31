-- ============================================================================
-- Study Buddies — Seed data
-- Run AFTER migrations 0001–0003.
--
-- WHAT THIS FILE DOES
-- Inserts the one university we launch with (UMN) and a starter course
-- catalog. Students can add any missing course themselves from the catalog
-- page, so this list does not need to be exhaustive — it needs to cover the
-- classes our first users are most likely to be taking.
--
-- ORDERING: the list leads with the College of Science and Engineering
-- first-year core, because CSE freshmen are our primary audience and those
-- large "weed-out" lecture courses are where study groups matter most.
--
-- ACCURACY NOTE: these department codes and numbers were entered by hand.
-- Before launch, spot-check them against the UMN Class Search and fix any
-- that have changed. A wrong course number is worse than a missing one.
-- ============================================================================

insert into public.universities (name, email_domain)
values ('University of Minnesota', 'umn.edu')
on conflict (email_domain) do nothing;

with umn as (
  select id from public.universities where email_domain = 'umn.edu'
)
insert into public.courses (university_id, department_code, course_number, course_name)
select umn.id, c.dept, c.num, c.name
from umn,
(values
  -- ══ CSE FIRST-YEAR CORE ══════════════════════════════════════════════
  -- The classes a typical College of Science and Engineering freshman is
  -- taking in their first two semesters. These should always be present.

  -- CSE first-year seminar (required of incoming CSE students)
  ('CSE',  '1001',  'First Year Experience'),

  -- Calculus — CSE students take the 1371/1372 sequence; 1271/1272 is the
  -- general track and 1571H/1572H is the honors track. All three appear
  -- because students place into different ones.
  ('MATH', '1371',  'CSE Calculus I'),
  ('MATH', '1372',  'CSE Calculus II'),
  ('MATH', '1271',  'Calculus I'),
  ('MATH', '1272',  'Calculus II'),
  ('MATH', '1571H', 'Honors Calculus I'),
  ('MATH', '1572H', 'Honors Calculus II'),

  -- Physics — the calculus-based sequence required for engineering majors
  ('PHYS', '1301W', 'Introductory Physics for Science and Engineering I'),
  ('PHYS', '1302W', 'Introductory Physics for Science and Engineering II'),

  -- Chemistry — lecture and its matching lab are separate registrations,
  -- so both are listed
  ('CHEM', '1061',  'Chemical Principles I'),
  ('CHEM', '1065',  'Chemical Principles I Laboratory'),
  ('CHEM', '1062',  'Chemical Principles II'),
  ('CHEM', '1066',  'Chemical Principles II Laboratory'),

  -- Intro programming — 1133 is the CS-major track, 1113 is the C/C++
  -- course most other engineering majors take
  ('CSCI', '1133',  'Introduction to Computing and Programming Concepts'),
  ('CSCI', '1113',  'Introduction to C/C++ Programming for Scientists and Engineers'),
  ('CSCI', '1913',  'Introduction to Algorithms, Data Structures, and Program Development'),
  ('EE',   '1301',  'Introduction to Computing Systems'),

  -- Writing requirement most freshmen complete in year one
  ('WRIT', '1301',  'University Writing'),

  -- ══ COMMON CSE SOPHOMORE / SECOND-YEAR ═══════════════════════════════
  ('MATH', '2373',  'CSE Linear Algebra and Differential Equations'),
  ('MATH', '2374',  'CSE Multivariable Calculus and Vector Analysis'),
  ('MATH', '2243',  'Linear Algebra and Differential Equations'),
  ('MATH', '2263',  'Multivariable Calculus'),
  ('CSCI', '2011',  'Discrete Structures of Computer Science'),
  ('CSCI', '2021',  'Machine Architecture and Organization'),
  ('CSCI', '4041',  'Algorithms and Data Structures'),
  ('AEM',  '2011',  'Statics'),
  ('ME',   '2011',  'Introduction to Engineering'),
  ('EE',   '2301',  'Introduction to Digital System Design'),
  ('STAT', '3021',  'Introduction to Probability and Statistics'),

  -- ══ SCIENCE / PRE-HEALTH ═════════════════════════════════════════════
  ('PHYS', '1201W', 'Introductory Physics I'),
  ('PHYS', '1202W', 'Introductory Physics II'),
  ('CHEM', '2301',  'Organic Chemistry I'),
  ('BIOL', '1009',  'General Biology'),
  ('BIOL', '2003',  'Foundations of Biology II'),
  ('PHSL', '3051',  'Human Physiology'),

  -- ══ COMMON LIBERAL-EDUCATION / GEN-ED COURSES ════════════════════════
  -- CSE students still need these, and they are large lectures where
  -- finding a study group is just as hard.
  ('ECON', '1101',  'Principles of Microeconomics'),
  ('ECON', '1102',  'Principles of Macroeconomics'),
  ('PSY',  '1001',  'Introduction to Psychology'),
  ('SOC',  '1001',  'Introduction to Sociology'),
  ('PHIL', '1001',  'Introduction to Logic'),
  ('HIST', '1301W', 'Global America'),
  ('ACCT', '2050',  'Introduction to Financial Reporting'),
  ('SPAN', '1001',  'Beginning Spanish')
) as c(dept, num, name)
on conflict (university_id, department_code, course_number) do nothing;
