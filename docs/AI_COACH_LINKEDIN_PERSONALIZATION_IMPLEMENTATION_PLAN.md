# AI Coach LinkedIn Trainer Personalization - Implementation Plan

**Version:** 1.0  
**Date:** 2025-01-29  
**Status:** Planning  
**Feature:** LinkedIn Trainer Personalization

---

## Overview

This document provides a step-by-step implementation plan for the LinkedIn Trainer Personalization feature, which allows trainers to connect their LinkedIn profiles via OAuth and automatically extract/display their professional information (name, headline, photo) on the AI Coach page.

---

## Prerequisites

1. **LinkedIn App Registration** (Admin Task):
   - Register LinkedIn app at https://www.linkedin.com/developers/apps
   - Obtain Client ID and Client Secret key
   - Configure OAuth redirect URI: `https://{domain}/auth/linkedin/callback`
   - Request permissions: `r_liteprofile` or `r_profile_basicinfo`
   - Store credentials (waiting for admin completion)

2. **Supabase Storage Setup**:
   - Create bucket: `trainer-photos`
   - Configure public read access
   - Set file size limits (max 5MB)

3. **Configuration Setup**:
   - Prepare `config/app.config.local.js` for LinkedIn credentials
   - Set up encryption key for token storage

---

## Implementation Phases

### Phase 1: Database & Configuration (Days 1-2)

#### 1.1 Database Migration
**Tasks**:
- [ ] Create migration script: `backend/migrations/add-linkedin-personalization-fields.sql`
- [ ] Add new fields to `ai_coach_trainer_personalization` table:
  - `trainer_photo_url` (TEXT, nullable) - Supabase Storage public URL
  - `trainer_bio` (TEXT, nullable) - Manual bio entry
  - `linkedin_data_extracted_at` (TIMESTAMP, nullable)
  - `linkedin_extraction_status` (VARCHAR) - 'pending', 'oauth_pending', 'success', 'failed', 'token_expired'
  - `linkedin_extraction_error` (TEXT, nullable)
  - `linkedin_access_token` (TEXT, nullable) - Encrypted
  - `linkedin_refresh_token` (TEXT, nullable) - Encrypted
  - `linkedin_token_expires_at` (TIMESTAMP, nullable)
  - `linkedin_profile_id` (VARCHAR, nullable)
  - `linkedin_oauth_state` (VARCHAR, nullable) - For CSRF protection
  - `auto_refresh_enabled` (BOOLEAN, default: false)
  - `last_refreshed_at` (TIMESTAMP, nullable)
- [ ] Add indexes:
  - Index on `linkedin_profile_id` for lookups
  - Index on `linkedin_extraction_status` for background jobs
  - Index on `auto_refresh_enabled` for scheduled refresh
- [ ] Test migration on development database
- [ ] Verify RLS policies still work with new fields
- [ ] Execute migration on production database

**Deliverables**:
- ✅ Database schema updated
- ✅ All new fields added with proper constraints
- ✅ Indexes created
- ✅ Migration script documented

**Files**:
- `backend/migrations/add-linkedin-personalization-fields.sql`

---

#### 1.2 Configuration Setup
**Tasks**:
- [ ] Add LinkedIn configuration to `config/app.config.js`:
  ```javascript
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || '',
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || '',
  LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || '',
  LINKEDIN_ENCRYPTION_KEY: process.env.LINKEDIN_ENCRYPTION_KEY || ''
  ```
- [ ] Update `config/app.config.local.js` template with LinkedIn fields
- [ ] Document configuration requirements in README
- [ ] Set up environment variables support for production
- [ ] Generate encryption key for token storage (AES-256)
- [ ] Store encryption key securely (config file or environment variable)

**Deliverables**:
- ✅ Configuration structure ready
- ✅ Encryption key generated and secured
- ✅ Documentation updated

**Files**:
- `config/app.config.js`
- `config/app.config.local.js` (template)
- `docs/CONFIGURATION.md` (if exists, update)

---

#### 1.3 Supabase Storage Setup
**Tasks**:
- [ ] Create Supabase Storage bucket: `trainer-photos`
- [ ] Configure bucket policies:
  - Public read access for uploaded photos
  - Authenticated write access (trainers/admins only)
  - File size limit: 5MB
  - Allowed MIME types: image/jpeg, image/png, image/webp
- [ ] Test bucket creation and permissions
- [ ] Document bucket configuration

**Deliverables**:
- ✅ Storage bucket created
- ✅ Policies configured
- ✅ Tested and documented

---

### Phase 2: Core Services (Days 3-5)

#### 2.1 LinkedIn OAuth Service
**Tasks**:
- [ ] Create `lms/services/linkedin-oauth-service.js`
- [ ] Implement OAuth 2.0 flow:
  - `initiateOAuth(trainerId, courseId)`: Generate authorization URL with state token
  - `handleOAuthCallback(code, state)`: Exchange code for tokens
  - `refreshAccessToken(refreshToken)`: Refresh expired access token
  - `revokeToken(accessToken)`: Revoke token if needed
  - `validateState(state)`: Validate OAuth state for CSRF protection
- [ ] Implement token encryption/decryption:
  - `encryptToken(token)`: Encrypt token using AES-256
  - `decryptToken(encryptedToken)`: Decrypt token when needed
- [ ] Error handling for OAuth failures
- [ ] Unit tests for OAuth flow
- [ ] Integration tests with LinkedIn sandbox

**Deliverables**:
- ✅ OAuth service functional
- ✅ Token encryption working
- ✅ CSRF protection implemented
- ✅ Tests passing

**Files**:
- `lms/services/linkedin-oauth-service.js`
- `lms/services/__tests__/linkedin-oauth-service.test.js` (if testing framework exists)

---

#### 2.2 LinkedIn Data Extraction Service
**Tasks**:
- [ ] Create `lms/services/linkedin-data-extraction-service.js`
- [ ] Implement LinkedIn API client:
  - Configure API base URL
  - Set up authentication headers
  - Implement rate limiting (respect LinkedIn limits)
  - Implement retry logic with exponential backoff
- [ ] Implement data extraction methods:
  - `getProfileData(accessToken)`: Get full profile data using access token
  - `extractName(profileData)`: Extract and combine first/last name
  - `extractHeadline(profileData)`: Extract professional headline
  - `extractPhotoUrl(profileData)`: Extract profile photo URL
  - `extractProfileUrl(profileData)`: Extract profile URL/vanity name
  - `extractProfileId(profileData)`: Extract LinkedIn profile ID
- [ ] Handle API errors gracefully:
  - Rate limiting (429 errors)
  - Token expiration (401 errors)
  - Profile not found (404 errors)
  - Network errors
- [ ] Unit tests for extraction methods
- [ ] Mock LinkedIn API responses for testing

**Deliverables**:
- ✅ Data extraction service functional
- ✅ Error handling comprehensive
- ✅ Rate limiting implemented
- ✅ Tests passing

**Files**:
- `lms/services/linkedin-data-extraction-service.js`
- `lms/services/__tests__/linkedin-data-extraction-service.test.js`

---

#### 2.3 Photo Storage Service
**Tasks**:
- [ ] Create `lms/services/trainer-photo-storage-service.js`
- [ ] Implement photo download from LinkedIn:
  - `downloadPhotoFromLinkedIn(photoUrl)`: Download photo from LinkedIn URL
  - Handle download errors gracefully
  - Validate image format and size
- [ ] Implement Supabase Storage upload:
  - `uploadPhotoToStorage(photoBuffer, trainerId, courseId)`: Upload to bucket
  - Generate unique filename: `{trainer_id}_{course_id}_{timestamp}.{ext}`
  - Generate public URL
  - Handle upload errors
- [ ] Implement photo replacement:
  - `replacePhoto(oldUrl, newBuffer, trainerId, courseId)`: Update existing photo
  - Delete old photo from storage if exists
- [ ] Implement fallback handling:
  - If download fails, use LinkedIn URL directly
  - If upload fails, use LinkedIn URL with warning
- [ ] Unit tests for photo operations

**Deliverables**:
- ✅ Photo storage service functional
- ✅ Download and upload working
- ✅ Fallback handling implemented
- ✅ Tests passing

**Files**:
- `lms/services/trainer-photo-storage-service.js`
- `lms/services/__tests__/trainer-photo-storage-service.test.js`

---

#### 2.4 Trainer Personalization Service Updates
**Tasks**:
- [ ] Update `lms/services/trainer-personalization-service.js` (if exists) or create new service
- [ ] Add LinkedIn integration methods:
  - `connectLinkedIn(trainerId, courseId)`: Initiate OAuth flow
  - `handleLinkedInCallback(code, state, trainerId, courseId)`: Process OAuth callback
  - `extractLinkedInData(trainerId, courseId)`: Extract and store LinkedIn data
  - `refreshLinkedInData(trainerId, courseId)`: Refresh LinkedIn data manually
  - `disconnectLinkedIn(trainerId, courseId)`: Revoke and remove LinkedIn connection
  - `getTrainerPersonalization(trainerId, courseId)`: Get trainer info with LinkedIn data
- [ ] Integrate with OAuth service
- [ ] Integrate with data extraction service
- [ ] Integrate with photo storage service
- [ ] Implement token refresh logic (automatic before API calls)
- [ ] Update database operations for new fields
- [ ] Handle single connection constraint (Decision 8): Replace existing connection if new one connected

**Deliverables**:
- ✅ Service updated with LinkedIn integration
- ✅ All methods functional
- ✅ Token refresh working
- ✅ Single connection enforced

**Files**:
- `lms/services/trainer-personalization-service.js` (create or update)

---

### Phase 3: Background Jobs (Days 6-7)

#### 3.1 Token Refresh Job
**Tasks**:
- [ ] Create `lms/services/background/linkedin-token-refresh-job.js`
- [ ] Implement scheduled job:
  - Check all trainers with LinkedIn connections
  - Identify tokens expiring within 24 hours
  - Refresh tokens using refresh token
  - Update database with new tokens
  - Log refresh results
- [ ] Handle refresh failures:
  - If refresh token expired, mark status as 'token_expired'
  - Notify trainer if re-authorization needed
- [ ] Schedule job (if using cron/scheduler):
  - Run daily to check for expiring tokens
- [ ] Unit tests for refresh logic

**Deliverables**:
- ✅ Token refresh job functional
- ✅ Scheduled job configured
- ✅ Failure handling implemented
- ✅ Tests passing

**Files**:
- `lms/services/background/linkedin-token-refresh-job.js`
- `lms/services/background/__tests__/linkedin-token-refresh-job.test.js`

---

#### 3.2 Weekly Profile Refresh Job
**Tasks**:
- [ ] Create `lms/services/background/linkedin-profile-refresh-job.js`
- [ ] Implement scheduled job:
  - Find all trainers with `auto_refresh_enabled = true`
  - Check if last refresh was more than 7 days ago
  - Refresh LinkedIn data for each trainer
  - Update database with new data
  - Update `last_refreshed_at` timestamp
  - Log refresh results
- [ ] Handle rate limiting:
  - Batch refresh to respect LinkedIn API limits
  - Implement delays between requests
- [ ] Handle failures gracefully:
  - Log errors for failed refreshes
  - Continue with other trainers even if one fails
  - Mark extraction status appropriately
- [ ] Schedule job:
  - Run weekly (e.g., every Sunday at 2 AM)
- [ ] Unit tests for refresh logic

**Deliverables**:
- ✅ Weekly refresh job functional
- ✅ Scheduled job configured (weekly)
- ✅ Rate limiting handled
- ✅ Error handling comprehensive
- ✅ Tests passing

**Files**:
- `lms/services/background/linkedin-profile-refresh-job.js`
- `lms/services/background/__tests__/linkedin-profile-refresh-job.test.js`

---

### Phase 4: UI Components (Days 8-11)

#### 4.1 Trainer Personalization Form
**Tasks**:
- [ ] Update or create trainer personalization form component
- [ ] Add LinkedIn connection section:
  - "Connect with LinkedIn" button (primary action)
  - Connection status display (Connected/Not Connected)
  - LinkedIn profile name when connected
  - Last sync time display
  - "Disconnect" button (with confirmation)
  - "Reconnect" option if already connected (Decision 8)
- [ ] Add LinkedIn URL input (optional fallback):
  - Text input field
  - Validation for LinkedIn URL format
  - Help text
- [ ] Add manual bio entry field (Decision 9):
  - Text area labeled "Bio (Optional - supplements LinkedIn headline)"
  - Placeholder text
  - Character limit indicator (500 chars recommended)
  - Help text explaining it supplements LinkedIn headline
- [ ] Add refresh button:
  - "Refresh from LinkedIn" button
  - Only enabled if LinkedIn is connected
  - Loading state during refresh
  - Success/error message display
- [ ] Add auto-refresh toggle:
  - Checkbox: "Enable automatic weekly refresh"
  - Maps to `auto_refresh_enabled` field
- [ ] Add data preview section:
  - Display extracted name, headline, photo
  - Display manual bio if entered
  - Show note about headline limitations
  - Allow manual override of all fields
- [ ] Implement OAuth flow:
  - Handle "Connect" button click → redirect to LinkedIn
  - Store OAuth state for CSRF protection
- [ ] Error state handling:
  - OAuth denied
  - OAuth failed
  - Token expired
  - API errors
  - Rate limiting
  - Network errors
  - Profile not found
- [ ] Form validation and submission
- [ ] Styling and responsive design

**Deliverables**:
- ✅ Personalization form complete
- ✅ LinkedIn OAuth integration working
- ✅ Manual bio entry functional
- ✅ Error handling comprehensive
- ✅ Responsive design

**Files**:
- `lms/components/trainer/linkedin-personalization-form.js` (or update existing form)
- `lms/styles/trainer-personalization.css` (if needed)

---

#### 4.2 OAuth Callback Handler
**Tasks**:
- [ ] Create OAuth callback route/page: `lms/pages/auth/linkedin-callback.js`
- [ ] Implement callback handler:
  - Extract `code` and `state` from URL parameters
  - Validate state token (CSRF protection)
  - Call `handleLinkedInCallback()` service method
  - Exchange code for tokens
  - Extract and store LinkedIn data
  - Show loading state during processing
  - Redirect to personalization form on success
  - Show error message on failure
- [ ] Handle error cases:
  - Invalid state token
  - OAuth error codes
  - Network failures
  - Service errors
- [ ] Styling for callback page

**Deliverables**:
- ✅ Callback handler functional
- ✅ Error handling implemented
- ✅ Redirects working correctly

**Files**:
- `lms/pages/auth/linkedin-callback.js` (or add route to router)
- `lms/components/auth/linkedin-callback.js` (component)

---

#### 4.3 Coach Page Display Components
**Tasks**:
- [ ] Update coach page to display trainer information
- [ ] Create trainer info component: `lms/components/ai-coach/trainer-info.js`
- [ ] Implement trainer photo display:
  - Circular avatar component
  - Load photo from Supabase Storage URL
  - Fallback to default avatar or initials if photo unavailable
  - Lazy loading for performance
- [ ] Implement trainer name display:
  - Prominent display (heading or large text)
  - Fallback to "Your Trainer" if name unavailable (Decision 6)
- [ ] Implement trainer bio display:
  - Show manual bio if available (Decision 9)
  - Otherwise show LinkedIn headline
  - Fallback to "Professional Trainer" if neither available (Decision 6)
  - Respect share level: only show if `share_level` permits
- [ ] Add LinkedIn profile link (optional):
  - Small link/icon to LinkedIn profile
  - Only show if `linkedin_profile_url` exists
- [ ] Implement share level logic:
  - `name_only`: Show name only
  - `name_expertise`: Show name + headline
  - `full`: Show name + bio + photo
- [ ] Responsive design:
  - Mobile: Stack vertically
  - Desktop: Horizontal layout in header/sidebar
- [ ] Update coach page to load and display trainer info:
  - Fetch trainer personalization data
  - Pass to trainer info component
  - Display in appropriate location (header/sidebar)

**Deliverables**:
- ✅ Trainer info component complete
- ✅ Coach page updated
- ✅ Share level logic working
- ✅ Fallback placeholders working (Decision 6)
- ✅ Responsive design

**Files**:
- `lms/components/ai-coach/trainer-info.js`
- `lms/components/coach-ai-page.js` (update to include trainer info)
- `lms/styles/ai-coach.css` (update styles)

---

### Phase 5: Testing & Documentation (Days 12-13)

#### 5.1 Unit Testing
**Tasks**:
- [ ] Write unit tests for OAuth service
- [ ] Write unit tests for data extraction service
- [ ] Write unit tests for photo storage service
- [ ] Write unit tests for personalization service
- [ ] Write unit tests for background jobs
- [ ] Achieve >80% code coverage for new services
- [ ] Fix any failing tests

**Deliverables**:
- ✅ All unit tests passing
- ✅ Code coverage targets met
- ✅ Test documentation updated

---

#### 5.2 Integration Testing
**Tasks**:
- [ ] Test OAuth flow end-to-end:
  - Connect LinkedIn profile
  - OAuth callback handling
  - Token storage and encryption
  - Data extraction
  - Photo download and upload
- [ ] Test data refresh:
  - Manual refresh
  - Automatic weekly refresh
  - Token refresh
- [ ] Test error scenarios:
  - OAuth denial
  - Token expiration
  - API failures
  - Photo download failures
  - Network errors
- [ ] Test fallback behavior:
  - Missing data → placeholders
  - Single connection constraint
  - Share level restrictions
- [ ] Test UI components:
  - Personalization form
  - Coach page display
  - OAuth callback page

**Deliverables**:
- ✅ Integration tests passing
- ✅ Error scenarios handled correctly
- ✅ Fallback behavior verified

---

#### 5.3 User Acceptance Testing
**Tasks**:
- [ ] Test trainer setup flow:
  - Connect LinkedIn profile
  - View extracted data
  - Enter manual bio
  - Enable auto-refresh
  - Disconnect LinkedIn
- [ ] Test learner experience:
  - View trainer info on coach page
  - Verify share levels work correctly
  - Check fallback placeholders
- [ ] Test edge cases:
  - Multiple connection attempts (should replace)
  - Missing LinkedIn data
  - Expired tokens
  - Profile not found
- [ ] Performance testing:
  - Photo loading speed
  - Form submission speed
  - OAuth redirect speed

**Deliverables**:
- ✅ All user flows tested
- ✅ Edge cases handled
- ✅ Performance acceptable

---

#### 5.4 Documentation
**Tasks**:
- [ ] Update API documentation for new services
- [ ] Create setup guide for LinkedIn app registration
- [ ] Document configuration requirements
- [ ] Create user guide for trainers:
  - How to connect LinkedIn
  - How to enter manual bio
  - How to refresh data
  - How to disconnect
- [ ] Update database schema documentation
- [ ] Create troubleshooting guide:
  - Common errors and solutions
  - OAuth issues
  - Photo upload issues
  - Token expiration

**Deliverables**:
- ✅ All documentation complete
- ✅ Setup guide available
- ✅ User guide available
- ✅ Troubleshooting guide available

**Files**:
- `docs/AI_COACH_LINKEDIN_SETUP_GUIDE.md`
- `docs/AI_COACH_LINKEDIN_USER_GUIDE.md`
- `docs/AI_COACH_LINKEDIN_TROUBLESHOOTING.md`

---

## Implementation Checklist

### Configuration & Setup
- [ ] LinkedIn app registered and credentials obtained
- [ ] Configuration added to `app.config.local.js`
- [ ] Encryption key generated and stored
- [ ] Supabase Storage bucket created
- [ ] Database migration executed

### Core Services
- [ ] OAuth service implemented and tested
- [ ] Data extraction service implemented and tested
- [ ] Photo storage service implemented and tested
- [ ] Personalization service updated and tested

### Background Jobs
- [ ] Token refresh job implemented and scheduled
- [ ] Weekly profile refresh job implemented and scheduled

### UI Components
- [ ] Personalization form created and functional
- [ ] OAuth callback handler implemented
- [ ] Coach page trainer info display implemented

### Testing & Documentation
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] User acceptance testing completed
- [ ] Documentation complete

---

## Dependencies & Blockers

### Dependencies
1. **LinkedIn App Registration** (Blocking):
   - Admin must complete LinkedIn app registration
   - Need Client ID and Client Secret before Phase 2 can begin
   - Estimated time: 1-2 hours

2. **Supabase Storage Access**:
   - Need access to create storage bucket
   - Need to configure bucket policies

3. **Configuration System**:
   - Must have encryption key generation capability
   - Must have environment variable support

### Potential Blockers
1. **LinkedIn API Access**: If LinkedIn app approval takes longer than expected
2. **Photo Storage Limits**: Need to verify Supabase Storage capacity
3. **Rate Limiting**: Need to understand exact LinkedIn API rate limits for free tier

---

## Timeline Estimate

- **Phase 1**: Database & Configuration - 2 days
- **Phase 2**: Core Services - 3 days
- **Phase 3**: Background Jobs - 2 days
- **Phase 4**: UI Components - 4 days
- **Phase 5**: Testing & Documentation - 2 days

**Total Estimated Time**: 13 days (2.5 weeks)

**Buffer for Unexpected Issues**: +3 days

**Total Timeline**: ~3 weeks

---

## Risk Mitigation

### Risk 1: LinkedIn API Changes
**Mitigation**: 
- Use official LinkedIn API with proper versioning
- Monitor LinkedIn API changelog
- Implement comprehensive error handling

### Risk 2: Token Expiration Issues
**Mitigation**:
- Implement automatic token refresh
- Daily job to refresh expiring tokens
- Clear error messages for expired tokens

### Risk 3: Photo Storage Costs
**Mitigation**:
- Monitor storage usage
- Implement photo cleanup for deleted connections
- Consider compression for large photos

### Risk 4: OAuth Security
**Mitigation**:
- Implement state token for CSRF protection
- Encrypt tokens at rest
- Use HTTPS for all OAuth redirects
- Validate redirect URIs

---

## Success Metrics

1. **Functionality**:
   - ✅ Trainers can connect LinkedIn profiles via OAuth
   - ✅ Data is extracted and displayed correctly
   - ✅ Manual bio entry works
   - ✅ Automatic refresh works weekly
   - ✅ Fallback placeholders work correctly

2. **Performance**:
   - OAuth flow completes in <30 seconds
   - Coach page loads trainer info in <1 second
   - Photo download/uploads complete in <10 seconds

3. **Reliability**:
   - OAuth success rate >95%
   - Data extraction success rate >90%
   - Token refresh success rate >98%

4. **User Experience**:
   - Trainers can set up in <5 minutes
   - Clear error messages for all failure scenarios
   - Intuitive UI for personalization

---

## Next Steps

1. **Immediate** (Waiting for Admin):
   - Complete LinkedIn app registration
   - Obtain Client ID and Client Secret
   - Configure OAuth redirect URI

2. **Phase 1 Start** (Once credentials available):
   - Begin database migration
   - Set up configuration
   - Create Supabase Storage bucket

3. **Parallel Work** (Can start now):
   - Review LinkedIn API documentation
   - Design UI mockups if needed
   - Set up testing framework

---

## References

- **Requirements Document**: `docs/AI_COACH_LINKEDIN_TRAINER_PERSONALIZATION_REQUIREMENTS.md`
- **LinkedIn API Documentation**: https://learn.microsoft.com/en-us/linkedin/
- **LinkedIn OAuth 2.0 Guide**: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication
- **Supabase Storage Documentation**: https://supabase.com/docs/guides/storage

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-29  
**Status**: Ready for Implementation

