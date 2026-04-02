"""
Seed script – creates a demo user and uploads sample documents.
Usage: python seed.py
"""
import asyncio
import httpx

BASE = "http://localhost:8000"

DEMO_USER = {
    "email": "demo@neurovault.ai",
    "full_name": "Demo User",
    "password": "demo1234!",
}

SAMPLE_DOCS = [
    ("sample_research.txt", "text/plain",
     b"""Artificial Intelligence in Healthcare: A Research Overview

Abstract:
This paper examines the application of artificial intelligence in modern healthcare settings.
AI technologies, particularly machine learning and deep learning, have shown tremendous promise
in disease diagnosis, drug discovery, and patient outcome prediction.

Key Findings:
1. AI diagnostic tools match or exceed radiologist accuracy in detecting certain cancers.
2. Natural language processing reduces clinical documentation time by up to 45%.
3. Predictive models can identify high-risk patients 72 hours before adverse events.

Conclusion:
AI integration in healthcare requires careful validation, ethical oversight, and clinician training.
The technology is a powerful tool but must augment rather than replace human judgment.
"""),
    ("climate_report.txt", "text/plain",
     b"""Global Climate Change: 2024 Status Report

Executive Summary:
Global average temperatures have risen 1.2 degrees Celsius above pre-industrial levels.
Arctic sea ice coverage has declined by 13% per decade since 1979.

Key Data Points:
- CO2 concentrations: 421 ppm (highest in 800,000 years)
- Sea level rise: 3.7 mm/year average over last decade
- Extreme weather events have increased 40% since 1980

Recommendations:
Immediate reduction of carbon emissions by 45% by 2030 is required to limit warming to 1.5C.
Renewable energy adoption must accelerate across all sectors.
"""),
]


async def seed():
    async with httpx.AsyncClient(base_url=BASE, timeout=30) as client:
        # Register demo user
        try:
            res = await client.post("/auth/register", json=DEMO_USER)
            if res.status_code == 201:
                token = res.json()["access_token"]
                print(f"✅ Created demo user: {DEMO_USER['email']}")
            elif res.status_code == 400:
                # Already exists, login
                res = await client.post("/auth/login",
                    data={"username": DEMO_USER["email"], "password": DEMO_USER["password"]})
                token = res.json()["access_token"]
                print(f"ℹ️  Demo user already exists, logged in")
            else:
                print(f"❌ Registration failed: {res.text}")
                return
        except Exception as e:
            print(f"❌ Could not connect to backend: {e}")
            return

        headers = {"Authorization": f"Bearer {token}"}

        # Upload sample documents
        for filename, content_type, content in SAMPLE_DOCS:
            res = await client.post(
                "/documents/upload",
                files={"file": (filename, content, content_type)},
                headers=headers,
            )
            if res.status_code == 202:
                print(f"✅ Uploaded: {filename}")
            else:
                print(f"❌ Upload failed for {filename}: {res.text}")

        print("\n🎉 Seed complete! Login with:")
        print(f"   Email:    {DEMO_USER['email']}")
        print(f"   Password: {DEMO_USER['password']}")


if __name__ == "__main__":
    asyncio.run(seed())
