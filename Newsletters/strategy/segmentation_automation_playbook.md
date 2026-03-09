# Segmentation and Automation Playbook

## Core audience lists

1. Active Buyers
- Definition: contacts actively searching or requesting showings/floorplans.
- Messaging emphasis: urgency, inventory, private previews, next-step consultations.

2. Long-Term Nurture
- Definition: earlier-stage leads not yet in active search mode.
- Messaging emphasis: education, neighborhood overviews, market updates, trust building.

3. Investors
- Definition: ROI-focused buyers, domestic and international.
- Messaging emphasis: yield potential, deposit structures, appreciation windows, rental demand.

## Campaign-to-segment weighting

- New Construction Spotlight: 50% Active Buyers, 40% Investors, 10% Long-Term Nurture.
- Market Intelligence: 50% Investors, 30% Long-Term Nurture, 20% Active Buyers.
- Miami Lifestyle and Events: 45% Long-Term Nurture, 30% Active Buyers, 25% Investors.
- Weekly Miami Brief: balanced across all three.

## Behavior tags and trigger logic

1. `preconstruction_active`
- Trigger: contact clicks 3+ links from New Construction emails in any 14-day period.
- Action: move to high-priority preconstruction path; auto-send consultation invite within 24 hours.

2. `market_data_engaged`
- Trigger: contact opens 2 consecutive Market Intelligence emails and clicks at least 1 data-related CTA.
- Action: send investor-focused follow-up with neighborhood-level metrics.

3. `lifestyle_relocator`
- Trigger: clicks on neighborhood or relocation content 2+ times in 30 days.
- Action: send relocation concierge sequence.

4. `inactive_60d`
- Trigger: no opens in 60 days.
- Action: shift to re-engagement cadence with one value-first email and one direct question email.

## Automation blueprint

1. Weekly scheduler
- Every Thursday, 11:00 AM ET.
- Dynamic content block selected by month and editorial calendar.

2. Post-send checks (24 hours after each campaign)
- If open and no click: send shorter follow-up with one CTA.
- If click and no form completion: send personal outreach email from Natalia.
- If no open: include in resend test with new subject line after 48 hours.

3. Lead engine integration
- Push engagement events into CRM fields:
- `last_newsletter_open_date`
- `last_newsletter_click_date`
- `engagement_score`
- `dominant_interest` (preconstruction, market-data, lifestyle)

## KPI benchmarks (first 90 days)

- Open rate target: 35% to 45%
- Click-through rate target: 4% to 8%
- Consultation booking conversion target: 1.5% to 3%
- Tagging accuracy target: 90%+ of engaged users assigned a dominant interest tag

## QA checklist before each send

1. All links tested (desktop and mobile).
2. Hero image below 300 KB.
3. Subject line and preheader not duplicated.
4. UTM parameters present on all CTAs.
5. Footer compliance fields populated (brokerage, unsubscribe, equal housing language).
