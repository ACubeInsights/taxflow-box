#!/bin/bash
# Test script for granular access control
# Run this AFTER restarting the API server: cd taxflow-api && npm run dev

API="http://localhost:3001/api"

echo "=== Step 1: Login as Employee ==="
EMP_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"Employee01@gmail.com","password":"Employee01"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['sessionToken'])")
echo "Employee token: ${EMP_TOKEN:0:20}..."

echo ""
echo "=== Step 2: Upload test files to client201's Tax folder (387196122627) ==="

# Create real PDF files
python3 -c "
pdf = b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 42>>stream\nBT /F1 18 Tf 72 700 Td (W2 Form 2024) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \n0000000230 00000 n \n0000000322 00000 n \ntrailer<</Size 6/Root 1 0 R>>startxref\n399\n%%EOF'
with open('/tmp/W2_Form_2024.pdf','wb') as f: f.write(pdf)
with open('/tmp/1099_INT_Chase.pdf','wb') as f: f.write(pdf.replace(b'W2 Form 2024', b'1099-INT Chase  '))
with open('/tmp/Schedule_C_Draft.pdf','wb') as f: f.write(pdf.replace(b'W2 Form 2024', b'Schedule C Draft'))
with open('/tmp/Engagement_Letter.pdf','wb') as f: f.write(pdf.replace(b'W2 Form 2024', b'Engagement Letter'))
print('Created 4 test PDF files')
"

# Upload to Tax folder (387196122627)
echo "Uploading W2_Form_2024.pdf..."
curl -s -X POST "$API/documents/upload" \
  -H "Authorization: Bearer $EMP_TOKEN" \
  -F "file=@/tmp/W2_Form_2024.pdf" \
  -F "folderId=387196122627" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"  → {d['file']['name']} (ID: {d['file']['id']})\")"

echo "Uploading 1099_INT_Chase.pdf..."
curl -s -X POST "$API/documents/upload" \
  -H "Authorization: Bearer $EMP_TOKEN" \
  -F "file=@/tmp/1099_INT_Chase.pdf" \
  -F "folderId=387196122627" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"  → {d['file']['name']} (ID: {d['file']['id']})\")"

# Upload to Uploads folder (387195319004)
echo "Uploading Schedule_C_Draft.pdf to Uploads folder..."
curl -s -X POST "$API/documents/upload" \
  -H "Authorization: Bearer $EMP_TOKEN" \
  -F "file=@/tmp/Schedule_C_Draft.pdf" \
  -F "folderId=387195319004" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"  → {d['file']['name']} (ID: {d['file']['id']})\")"

echo "Uploading Engagement_Letter.pdf to Uploads folder..."
curl -s -X POST "$API/documents/upload" \
  -H "Authorization: Bearer $EMP_TOKEN" \
  -F "file=@/tmp/Engagement_Letter.pdf" \
  -F "folderId=387195319004" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"  → {d['file']['name']} (ID: {d['file']['id']})\")"

echo ""
echo "=== Step 3: Set permissions (as employee) ==="
echo ""
echo "NOTE: After server restart, get the file IDs from Step 2 output above,"
echo "then use these curl commands to test permissions:"
echo ""
echo "--- Set viewer access on Tax folder for client201 ---"
echo "curl -s -X POST '$API/permissions' -H 'Authorization: Bearer \$EMP_TOKEN' -H 'Content-Type: application/json' -d '{\"clientId\":\"CLIENT201_DB_ID\",\"resourceId\":\"387196122627\",\"resourceType\":\"folder\",\"accessLevel\":\"viewer\",\"resourceName\":\"Tax Returns\"}'"
echo ""
echo "--- Set writer access on a specific file ---"
echo "curl -s -X POST '$API/permissions' -H 'Authorization: Bearer \$EMP_TOKEN' -H 'Content-Type: application/json' -d '{\"clientId\":\"CLIENT201_DB_ID\",\"resourceId\":\"FILE_ID_HERE\",\"resourceType\":\"file\",\"accessLevel\":\"writer\",\"resourceName\":\"Schedule_C_Draft.pdf\"}'"
echo ""
echo "--- Check what client201 can see ---"
echo "Login as client201, then GET /api/vaults/387196122627/files"
echo ""
echo "=== Done ==="
echo ""
echo "To find client201's DB ID, run:"
echo "curl -s '$API/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"client201@gmail.com\",\"password\":\"Client201\"}' | python3 -c \"import sys,json; print(json.load(sys.stdin)['user']['id'])\""
