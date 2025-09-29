# 📱 Manual Dussehra Campaign - Complete Tutorial

## 🎯 What is Manual Mode?
Manual mode lets you approve each message before sending. You see the customer details, message preview, and then decide: Send ✅ or Skip ❌

## 📋 Step-by-Step Process:

### **STEP 1: Initialize Campaign**
```bash
curl -X POST http://localhost:3001/api/manual-dussehra-campaign \
  -H "Content-Type: application/json" \
  -d '{
    "csvData": [
      {"name": "Saurabh", "phone": "7375938371"},
      {"name": "Deepak", "phone": "6375623182"}
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Manual campaign initialized",
  "totalCustomers": 2,
  "nextAction": "Use /api/next-manual-message to process each message with approval"
}
```

---

### **STEP 2: Get Next Customer for Approval**
```bash
curl -X POST http://localhost:3001/api/next-manual-message
```

**Expected Response:**
```json
{
  "needsApproval": true,
  "customer": {
    "name": "Saurabh",
    "phone": "917375938371",
    "originalPhone": "7375938371"
  },
  "messagePreview": "🙏 *नमस्ते Saurabh जी* 🙏\n\n🌺 *दुर्गा पूजा और दशहरा की हार्दिक शुभकामनाएं* 🌺...",
  "progress": "1/2",
  "actions": {
    "approve": "POST /api/approve-manual-message",
    "reject": "POST /api/reject-manual-message"
  }
}
```

---

### **STEP 3A: Approve Message (Send)**
```bash
curl -X POST http://localhost:3001/api/approve-manual-message
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Festival message sent to Saurabh",
  "customer": {"name": "Saurabh", "phone": "917375938371"},
  "progress": "1/2",
  "nextAction": "Call /api/next-manual-message for next customer"
}
```

### **STEP 3B: Reject Message (Skip)**
```bash
curl -X POST http://localhost:3001/api/reject-manual-message
```

**Expected Response:**
```json
{
  "rejected": true,
  "message": "Message rejected for Saurabh",
  "progress": "1/2",
  "nextAction": "Call /api/next-manual-message for next customer"
}
```

---

### **STEP 4: Repeat for All Customers**
Keep calling `/api/next-manual-message` until you get:

```json
{
  "completed": true,
  "message": "Campaign completed!",
  "results": {
    "success": 1,
    "failed": 0,
    "skipped": 1
  }
}
```

## 🚀 Quick Test Script

Run this in PowerShell to test:

```powershell
# Initialize campaign
$init = Invoke-RestMethod -Uri "http://localhost:3001/api/manual-dussehra-campaign" -Method POST -ContentType "application/json" -Body '{"csvData":[{"name":"Saurabh","phone":"7375938371"}]}'
Write-Host "Campaign initialized: $($init.totalCustomers) customers"

# Get first customer
$next = Invoke-RestMethod -Uri "http://localhost:3001/api/next-manual-message" -Method POST
Write-Host "Customer: $($next.customer.name) - $($next.customer.phone)"

# Approve message
$approve = Invoke-RestMethod -Uri "http://localhost:3001/api/approve-manual-message" -Method POST
Write-Host "Result: $($approve.message)"
```

## 💡 Real-World Usage Tips:

1. **Review Each Message**: Check customer name and phone before approving
2. **Quality Control**: Skip customers with suspicious/wrong numbers  
3. **Batch Processing**: Process 10-20 customers at a time
4. **Break When Needed**: Campaign stays active, resume anytime
5. **Monitor Results**: Check success/failure rates as you go

## ⚠️ Important Notes:

- Campaign data stays in memory until server restart
- Only one manual campaign can run at a time
- Invalid/duplicate numbers are auto-skipped
- You can quit anytime and resume later

This gives you **complete control** over every message sent! 🎯