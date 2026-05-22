const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Starting API Verification Tests...');
  let sessionCookie = '';

  // Helper to make requests with cookies
  async function request(path, options = {}) {
    const headers = options.headers || {};
    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });
    
    // Track cookie if returned
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      // Extract the goat-session part
      const match = setCookie.match(/goat-session=[^;]+/);
      if (match) {
        sessionCookie = match[0];
      }
    }

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      // Not JSON
    }

    return { status: response.status, data };
  }

  // 1. LOGIN
  console.log('\n1. Logging in as rishabh@goatsaas.com...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'rishabh@goatsaas.com', password: 'password' }),
    headers: { 'Content-Type': 'application/json' },
  });

  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginRes.data.success, true);
  assert.strictEqual(loginRes.data.user.email, 'rishabh@goatsaas.com');
  assert.strictEqual(loginRes.data.user.orgId, 'org_goatsaas');
  assert.strictEqual(loginRes.data.user.orgRole, 'admin');
  console.log('✓ Login Successful');

  // 2. GET ORGANIZATION
  console.log('\n2. Fetching organization details...');
  const orgRes = await request('/api/settings/organization');
  assert.strictEqual(orgRes.status, 200);
  assert.strictEqual(orgRes.data.orgName, 'GOATSaaS Inc.');
  
  // Verify members (Rishabh Dev and Super Admin share org_goatsaas)
  const memberEmails = orgRes.data.members.map(m => m.email);
  assert.ok(memberEmails.includes('rishabh@goatsaas.com'));
  assert.ok(memberEmails.includes('admin@goatsaas.com'));
  
  // Verify collaborator@goatsaas.com is pending invite
  const pendingEmails = orgRes.data.invites.map(i => i.email);
  assert.ok(pendingEmails.includes('collaborator@goatsaas.com'));
  console.log('✓ Organization Details Verified');

  // 3. INVITE A NEW MEMBER
  console.log('\n3. Inviting a new teammate...');
  const inviteEmail = `test_invite_${Date.now()}@goatsaas.com`;
  const inviteRes = await request('/api/settings/invites', {
    method: 'POST',
    body: JSON.stringify({ email: inviteEmail, role: 'member' }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert.strictEqual(inviteRes.status, 200);
  assert.strictEqual(inviteRes.data.success, true);
  const inviteId = inviteRes.data.invite.id;
  console.log(`✓ Invitation sent successfully to ${inviteEmail}`);

  // Confirm invite is listed in org invites
  const orgResAfterInvite = await request('/api/settings/organization');
  const pendingEmailsAfter = orgResAfterInvite.data.invites.map(i => i.email);
  assert.ok(pendingEmailsAfter.includes(inviteEmail));
  console.log('✓ Invitation listed in pending invites list');

  // 4. REVOKE THE INVITATION
  console.log('\n4. Revoking the invitation...');
  const revokeRes = await request('/api/settings/invites', {
    method: 'DELETE',
    body: JSON.stringify({ inviteId }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert.strictEqual(revokeRes.status, 200);
  assert.strictEqual(revokeRes.data.success, true);
  console.log('✓ Invitation revoked successfully');

  // Confirm invite is no longer listed as pending
  const orgResAfterRevoke = await request('/api/settings/organization');
  const pendingEmailsFinal = orgResAfterRevoke.data.invites.map(i => i.email);
  assert.ok(!pendingEmailsFinal.includes(inviteEmail));
  console.log('✓ Invitation removed from pending list');

  // 5. UPDATE USER PROFILE
  console.log('\n5. Updating user profile...');
  const profileRes = await request('/api/settings/profile', {
    method: 'POST',
    body: JSON.stringify({ name: 'Rishabh Custom', email: 'rishabh@goatsaas.com' }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert.strictEqual(profileRes.status, 200);
  assert.strictEqual(profileRes.data.success, true);
  assert.strictEqual(profileRes.data.user.name, 'Rishabh Custom');
  assert.strictEqual(profileRes.data.user.avatar, 'RC'); // Initial of Rishabh Custom
  console.log('✓ Profile updated locally in memory');

  // Verify auth/me has the updated name & avatar
  const meRes = await request('/api/auth/me');
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meRes.data.user.name, 'Rishabh Custom');
  assert.strictEqual(meRes.data.user.avatar, 'RC');
  console.log('✓ Session JWT re-signed and verified via /api/auth/me');

  // 6. RENAME THE ORGANIZATION
  console.log('\n6. Renaming organization/workspace...');
  const renameRes = await request('/api/settings/organization', {
    method: 'PATCH',
    body: JSON.stringify({ orgName: 'GOAT Enterprise' }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert.strictEqual(renameRes.status, 200);
  assert.strictEqual(renameRes.data.success, true);
  assert.strictEqual(renameRes.data.orgName, 'GOAT Enterprise');
  console.log('✓ Organization renamed to GOAT Enterprise');

  // Verify auth/me has the updated orgName
  const meResAfterRename = await request('/api/auth/me');
  assert.strictEqual(meResAfterRename.data.user.orgName, 'GOAT Enterprise');
  console.log('✓ Session JWT updated organization name verified');

  // 7. CLEANUP MEMORY STATE FOR SUBSEQUENT RUNS
  console.log('\n7. Restoring original user details...');
  await request('/api/settings/profile', {
    method: 'POST',
    body: JSON.stringify({ name: 'Rishabh Dev', email: 'rishabh@goatsaas.com' }),
    headers: { 'Content-Type': 'application/json' },
  });
  await request('/api/settings/organization', {
    method: 'PATCH',
    body: JSON.stringify({ orgName: 'GOATSaaS Inc.' }),
    headers: { 'Content-Type': 'application/json' },
  });
  console.log('✓ Profile and Workspace names restored');

  // 8. TEST SIGN-UP AUTO-PROVISIONS WORKSPACE
  console.log('\n8. Testing signup flow for new user workspace auto-provisioning...');
  sessionCookie = ''; // Clear cookie to act as guest
  const signUpEmail = `new_owner_${Date.now()}@test.com`;
  const signUpRes = await request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'New Owner', email: signUpEmail, password: 'password123' }),
    headers: { 'Content-Type': 'application/json' },
  });
  assert.strictEqual(signUpRes.status, 200);
  assert.strictEqual(signUpRes.data.success, true);
  assert.strictEqual(signUpRes.data.user.orgRole, 'owner');
  assert.strictEqual(signUpRes.data.user.orgName, "New Owner's Workspace");
  assert.ok(signUpRes.data.user.orgId.startsWith('org_'));
  console.log('✓ Auto-provisioning workspace successful on signup');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
