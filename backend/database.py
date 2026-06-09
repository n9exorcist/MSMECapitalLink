from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./msme_capital_link.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class CompanyAuditRecord(Base):
    __tablename__ = "underwriting_records"
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, index=True)
    credit_score = Column(Integer)
    health_label = Column(String)
    calculated_turnover = Column(Float)

def init_db():
    Base.metadata.create_all(bind=engine)