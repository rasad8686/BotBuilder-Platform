# A/B Testing System

## Overview

The A/B Testing system allows you to create, manage, and analyze experiments to optimize your bot's performance. Test different messages, flows, widgets, and more to find what works best for your users.

### What is A/B Testing?

A/B testing (also known as split testing) is a method of comparing two or more versions of something to determine which performs better. In BotBuilder, you can test:

- **Messages**: Different welcome messages, responses, or prompts
- **Flows**: Alternative conversation paths
- **Widgets**: Widget appearance and behavior
- **Buttons**: CTA text, colors, and placement
- **Tours**: Onboarding tour variations

### How it Works in BotBuilder

1. **Create a Test**: Define what you want to test and set up variants
2. **Define Variants**: Create A (control) and B (or more) versions
3. **Set Traffic Split**: Decide how to divide visitors between variants
4. **Start Test**: Launch the experiment
5. **Collect Data**: Track impressions and conversions
6. **Analyze Results**: View statistical significance
7. **Declare Winner**: Choose the best-performing variant

### Statistical Significance

Statistical significance tells you whether the difference between variants is real or just random chance. BotBuilder calculates:

- **Confidence Level**: How sure we are that B is better than A (e.g., 95% confidence)
- **Lift**: The percentage improvement of test variant over control
- **Z-Score**: The statistical measure of difference

A test is considered significant when confidence is 95% or higher.

## Quick Start

### 1. Create a Test

```bash
POST /api/ab-tests
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Welcome Message Test",
  "test_type": "message",
  "goal_metric": "conversion",
  "traffic_split": { "A": 50, "B": 50 }
}
```

### 2. Define Variants

Variants A and B are created automatically. Add more if needed:

```bash
POST /api/ab-tests/:id/variants
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "C",
  "content": {
    "message": "Hey there! How can I help you today?"
  }
}
```

### 3. Set Traffic Split

Update traffic distribution:

```bash
PUT /api/ab-tests/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "traffic_split": { "A": 40, "B": 40, "C": 20 }
}
```

### 4. Start Test

```bash
POST /api/ab-tests/:id/start
Authorization: Bearer <token>
```

### 5. Monitor Results

```bash
GET /api/ab-tests/:id/analytics
Authorization: Bearer <token>
```

### 6. Declare Winner

```bash
POST /api/ab-tests/:id/declare-winner
Authorization: Bearer <token>
Content-Type: application/json

{
  "variantId": "uuid-of-winning-variant"
}
```

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ab-tests` | List all tests |
| POST | `/api/ab-tests` | Create new test |
| GET | `/api/ab-tests/:id` | Get test details |
| PUT | `/api/ab-tests/:id` | Update test |
| DELETE | `/api/ab-tests/:id` | Delete test |
| POST | `/api/ab-tests/:id/duplicate` | Duplicate test |
| POST | `/api/ab-tests/:id/start` | Start test |
| POST | `/api/ab-tests/:id/pause` | Pause test |
| POST | `/api/ab-tests/:id/resume` | Resume test |
| POST | `/api/ab-tests/:id/complete` | Complete test |
| POST | `/api/ab-tests/:id/declare-winner` | Declare winner |
| GET | `/api/ab-tests/:id/variants` | Get variants |
| POST | `/api/ab-tests/:id/variants` | Add variant |
| PUT | `/api/ab-tests/:id/variants/:vid` | Update variant |
| DELETE | `/api/ab-tests/:id/variants/:vid` | Delete variant |
| GET | `/api/ab-tests/:id/analytics` | Get analytics |
| GET | `/api/ab-tests/:id/analytics/daily` | Get daily analytics |

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/public/ab-tests/assign` | Assign variant to visitor |
| POST | `/api/public/ab-tests/convert` | Record conversion |
| GET | `/api/public/ab-tests/:id/variant/:visitorId` | Get assigned variant |
| POST | `/api/public/ab-tests/batch-assign` | Batch assign variants |
| POST | `/api/public/ab-tests/batch-convert` | Batch record conversions |

### Request/Response Formats

#### Create Test Request
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "test_type": "message|flow|widget|welcome|button|tour",
  "goal_metric": "conversion|engagement|response_rate|click_rate",
  "traffic_split": { "A": 50, "B": 50 },
  "auto_winner_enabled": false,
  "auto_winner_threshold": 95
}
```

#### Test Response
```json
{
  "id": "uuid",
  "workspace_id": 1,
  "name": "Welcome Message Test",
  "description": "Testing different welcome messages",
  "status": "draft|running|paused|completed",
  "test_type": "message",
  "goal_metric": "conversion",
  "traffic_split": { "A": 50, "B": 50 },
  "winner_variant": null,
  "winner_confidence": null,
  "started_at": null,
  "ended_at": null,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "variants": [
    {
      "id": "uuid",
      "name": "A",
      "is_control": true,
      "content": {},
      "stats": {
        "impressions": 1000,
        "conversions": 100,
        "totalValue": 500
      }
    }
  ]
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AB_TEST_NOT_FOUND` | 404 | Test not found |
| `AB_TEST_VARIANT_NOT_FOUND` | 404 | Variant not found |
| `AB_TEST_ASSIGNMENT_NOT_FOUND` | 404 | No assignment for visitor |
| `AB_TEST_ALREADY_RUNNING` | 409 | Test is already running |
| `AB_TEST_MODIFY_RUNNING` | 409 | Cannot modify running test |
| `AB_TEST_DELETE_RUNNING` | 409 | Cannot delete running test |
| `AB_TEST_DUPLICATE_CONVERSION` | 409 | Conversion already recorded |
| `AB_TEST_DUPLICATE_VARIANT` | 409 | Variant name exists |
| `AB_TEST_INVALID_STATE` | 422 | Invalid status transition |
| `AB_TEST_MIN_VARIANTS` | 422 | Need at least 2 variants |
| `AB_TEST_MAX_VARIANTS` | 422 | Maximum 4 variants |
| `AB_TEST_CONTROL_VARIANT` | 422 | Cannot delete control |
| `AB_TEST_NOT_RUNNING` | 422 | Test not running |
| `AB_TEST_INVALID_TRAFFIC_SPLIT` | 422 | Split must total 100% |
| `AB_TEST_WORKSPACE_ACCESS` | 403 | Access denied |

## SDK Integration

See [SDK Documentation](./ab-test-sdk.md) for detailed integration guide.

### Quick Example

```html
<script src="https://cdn.botbuilder.app/ab-test-sdk.js"></script>
<script>
  BotBuilderABTest.init({ workspaceId: 'your-workspace-id' });

  // Get variant
  const variant = await BotBuilderABTest.getVariant('test-id');
  console.log('Assigned variant:', variant.name);

  // Track conversion
  await BotBuilderABTest.trackConversion('test-id', {
    type: 'click',
    value: 10
  });
</script>
```

## Best Practices

### Sample Size Recommendations

| Baseline Rate | Minimum Detectable Effect | Required Sample (per variant) |
|---------------|---------------------------|-------------------------------|
| 1% | 50% relative | ~30,000 |
| 5% | 20% relative | ~10,000 |
| 10% | 10% relative | ~5,000 |
| 20% | 5% relative | ~3,000 |

### Test Duration

- **Minimum**: Run for at least 1-2 weeks to account for day-of-week variations
- **Full Cycle**: Capture at least one complete business cycle
- **Statistical Significance**: Wait until you reach 95% confidence

### When to Stop a Test

**Stop early if:**
- You've reached statistical significance (95%+ confidence)
- One variant is clearly harmful (significant negative impact)
- External factors invalidate the test (bug, outage)

**Don't stop if:**
- Results look good but confidence is low
- You've only run for a few days
- Sample size is below recommendations

### Common Mistakes

1. **Stopping too early**: Wait for statistical significance
2. **Testing too many things**: Test one change at a time
3. **Ignoring segments**: Results may vary by user type
4. **Not defining goals upfront**: Know what you're measuring
5. **Testing low-traffic pages**: Won't get significant results

## Troubleshooting

### FAQ

**Q: Why isn't my test showing significant results?**
A: You may need more traffic. Check the sample size recommendations above.

**Q: Can I change a test while it's running?**
A: You can pause/resume, but changing variants invalidates collected data.

**Q: How long should I run a test?**
A: Until you reach statistical significance, typically 1-4 weeks.

**Q: What if both variants perform the same?**
A: Keep the simpler/cheaper option. No difference means both work.

### Common Issues

**Test not starting**
- Ensure at least 2 variants exist
- Check test status is "draft"

**No conversions recording**
- Verify visitorId matches assignment
- Check conversion endpoint is called

**Significance not calculating**
- Need minimum 30 impressions per variant
- Both variants need some conversions

## Support

For additional help:
- Email: support@botbuilder.app
- Docs: https://docs.botbuilder.app
- Discord: https://discord.gg/botbuilder
