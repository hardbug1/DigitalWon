-- PostgreSQL 초기화 스크립트
-- 원화 기반 스테이블 코인 결제 시스템

-- 데이터베이스가 이미 존재하는지 확인
CREATE DATABASE IF NOT EXISTS stablecoin;

-- 확장 기능 활성화 (UUID 생성용)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 기본 권한 설정
GRANT ALL PRIVILEGES ON DATABASE stablecoin TO postgres;

-- 코멘트 추가
COMMENT ON DATABASE stablecoin IS 'Stablecoin Payment System Database'; 