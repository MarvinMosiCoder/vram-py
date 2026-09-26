"""Report building: what the command line prints and the API returns."""
import httpx

from app import schemas
from app.helpers.memecoin import analyzer

BONK = "bonk-DezXAZ8z"
BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"


def test_failed_source_becomes_an_error_not_a_crash(raw):
    report = analyzer.build_report(BONK_MINT, raw(BONK, "dexscreener"), httpx.ConnectTimeout(""))

    assert report.market is not None
    assert report.safety is None
    assert report.errors == {"rugcheck": "ConnectTimeout"}
    assert report.assessment.verdict != "Watch"


def test_report_survives_the_trip_through_json(raw):
    # The API sends the report as JSON; nothing may be lost on the way.
    report = analyzer.build_report(BONK_MINT, raw(BONK, "dexscreener"), raw(BONK, "rugcheck"))
    assert schemas.CoinReport.model_validate_json(report.model_dump_json()) == report
