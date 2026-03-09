# MiamiBeachApartments.com Newsletter System

This package gives you a ready-to-run weekly and monthly newsletter program aligned to the Miami Beach Apartments brand.

## What is included

- `templates/base_template.html` - reusable branded HTML shell.
- `templates/weekly_miami_brief.html` - weekly send template.
- `templates/campaign_new_construction_spotlight.html` - campaign 1 template.
- `templates/campaign_market_intelligence.html` - campaign 2 template.
- `templates/campaign_miami_lifestyle.html` - campaign 3 template.
- `strategy/90_day_editorial_calendar.md` - March to May 2026 send schedule.
- `strategy/segmentation_automation_playbook.md` - lists, tags, triggers, and CRM logic.
- `strategy/assets_manifest.md` - exact brand assets to upload into your email platform.
- `strategy/subject_line_and_preheader_bank.md` - tested subject/preheader options.
- `tracking/newsletter_kpi_tracker.csv` - starter reporting sheet.
- `../FollowUpBossIntegration/` - custom API bridge for Follow Up Boss `emCampaigns` and `emEvents`.

## Recommended send cadence

- Weekly: 1 send every Thursday at 11:00 AM ET.
- Monthly anchors:
- New Construction Spotlight: 2x per month.
- Miami Market Intelligence: 1x per month.
- Miami Lifestyle and Events: 1x per month.
- Optional Investor Brief: quarterly.

## Implementation sequence

1. Upload logo and photo assets from `strategy/assets_manifest.md` to your ESP CDN.
2. Replace placeholder URLs in the HTML templates.
3. Create 3 audience segments plus behavior tags from `strategy/segmentation_automation_playbook.md`.
4. Load the 90-day calendar and assign each send to a segment variant.
5. Track weekly performance in `tracking/newsletter_kpi_tracker.csv`.
