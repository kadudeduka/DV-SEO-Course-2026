# AI Coach LinkedIn Trainer Personalization - Requirements Document

## Problem Statement

Currently, the AI Coach trainer personalization requires trainers to manually enter their name, bio, and photo. This creates friction in the setup process and may result in outdated or incomplete trainer information being displayed on the coach page.

Trainers should be able to provide their LinkedIn profile URL and have the system automatically extract and display their professional information (name, bio, photo) on the coach page, making personalization easier and ensuring consistency with their professional LinkedIn presence.

## Goals

1. **Simplify Trainer Setup**: Allow trainers to provide a LinkedIn URL instead of manually entering all details
2. **Automatic Data Extraction**: Extract trainer name, bio, and photo from LinkedIn profile
3. **Display on Coach Page**: Show personalized trainer information on the AI Coach interface
4. **Maintain Data Freshness**: Optionally refresh trainer data from LinkedIn periodically or on-demand
5. **Fallback Handling**: Handle cases where LinkedIn data cannot be retrieved using standard placeholders (Decision 6)

## User Stories

### US-1: Trainer Connects LinkedIn Profile via OAuth
**As a** trainer  
**I want to** connect my LinkedIn profile via OAuth authorization  
**So that** the system can automatically fetch my professional information  

**Acceptance Criteria:**
- Trainer can click "Connect LinkedIn" button in personalization form
- System redirects trainer to LinkedIn authorization page
- Trainer grants required permissions (profile basic info)
- System handles OAuth callback and stores tokens
- LinkedIn profile URL is automatically extracted and stored
- Trainer can optionally manually enter LinkedIn URL as fallback

### US-2: System Extracts Trainer Information from LinkedIn API
**As a** system  
**I want to** extract trainer name, headline, and photo from LinkedIn API  
**So that** trainer information can be automatically populated  

**Acceptance Criteria:**
- System uses LinkedIn OAuth access token to call LinkedIn API
- System extracts trainer first name and last name from API response
- System extracts trainer headline (professional tagline) from API response
- System extracts trainer profile photo URL from API response
- Extracted data is stored in appropriate database fields
- System handles API errors gracefully (rate limits, token expiration, etc.)
- System clearly indicates that only basic info is available (not full work history/education)

### US-3: Display Trainer Information on Coach Page
**As a** learner  
**I want to** see the trainer's name, bio, and photo on the AI Coach page  
**So that** I know which trainer's AI assistant I'm interacting with  

**Acceptance Criteria:**
- Trainer name is displayed prominently on the coach page
- Trainer bio is displayed (if available and share level permits)
- Trainer photo is displayed (if available and share level permits)
- Information respects the trainer's configured share level (`name_only`, `name_expertise`, `full`)
- Display updates when trainer information is refreshed

### US-4: Manual Refresh of Trainer Information
**As a** trainer  
**I want to** manually refresh my information from LinkedIn  
**So that** I can update my displayed information after making changes to my LinkedIn profile  

**Acceptance Criteria:**
- Trainer can trigger a refresh of their LinkedIn data
- System shows loading state during refresh
- System shows success/failure message after refresh
- Updated information is immediately visible on coach page

### US-5: Handle LinkedIn API Limitations
**As a** system  
**I want to** gracefully handle cases where LinkedIn data cannot be retrieved  
**So that** the coach page still functions when LinkedIn information is unavailable  

**Acceptance Criteria:**
- System falls back to manually entered data if LinkedIn extraction fails
- System shows appropriate error messages for different failure scenarios (private profile, API limits, network errors)
- Coach page continues to function with default/minimal information if LinkedIn data is unavailable

## Functional Requirements

### FR-1: LinkedIn URL Input
1. **URL Field**: Trainer personalization form must include a field for LinkedIn profile URL
2. **URL Validation**: System must validate LinkedIn URL format:
   - Valid formats: `https://www.linkedin.com/in/{username}`, `https://linkedin.com/in/{username}`, `http://www.linkedin.com/in/{username}`
   - Invalid formats should be rejected with clear error message
3. **URL Storage**: Valid URLs must be stored in `linkedin_profile_url` field

### FR-2: LinkedIn Data Extraction
1. **OAuth Flow**: Implement LinkedIn OAuth 2.0 flow to obtain trainer authorization
   - Redirect trainer to LinkedIn authorization page
   - Handle OAuth callback with authorization code
   - Exchange code for access token
   - Store refresh token for future use

2. **Name Extraction**: Extract trainer's first name and last name from LinkedIn API
   - Combine to form full name
   - Store in `trainer_info.name` field

3. **Headline Extraction**: Extract trainer's professional headline from LinkedIn API
   - Headline serves as basic bio/summary (since full bio is not available in free tier)
   - Store in `trainer_info.headline` field
   - Allow trainer to supplement with manual bio entry (see Decision 9)

4. **Photo Extraction**: Extract trainer's profile photo from LinkedIn API
   - Get photo URL from profile response
   - **Download photo and store in Supabase Storage** (Decision 3)
   - Upload to `trainer-photos` bucket in Supabase Storage
   - Store public URL path in `trainer_photo_url` field
   - Handle photo download errors gracefully with fallback to default avatar

5. **Profile URL**: Store LinkedIn profile URL for linking
   - Extract from profile response or use provided URL
   - Store in `linkedin_profile_url` field

6. **Data Storage**: Extracted data must be stored in:
   - `trainer_info` JSONB field: `{name: "First Last", headline: "...", linkedin_id: "...", bio: "..."}` (bio is optional manual entry)
   - `trainer_photo_url` field (Supabase Storage public URL path)
   - `linkedin_profile_url` field (profile URL)

7. **Manual Bio Entry**: Allow trainer to supplement LinkedIn headline with manual bio
   - Provide text area field in personalization form for manual bio entry
   - Store in `trainer_info.bio` field
   - Display preference: Manual bio > LinkedIn headline > Placeholder

### FR-3: Coach Page Display
1. **Header Section**: Display trainer information in the coach page header or sidebar
2. **Trainer Photo**: Display trainer photo (circular avatar from Supabase Storage, with fallback to default avatar/initials)
3. **Trainer Name**: Display trainer name prominently (LinkedIn name or placeholder "Your Trainer")
4. **Trainer Bio**: Display trainer bio (manual bio if available, otherwise LinkedIn headline, or placeholder "Professional Trainer")
5. **LinkedIn Link**: Optionally display a link to trainer's LinkedIn profile (if connected)

### FR-4: Share Level Control
1. **Respect Share Level**: Display must respect trainer's configured share level:
   - `name_only`: Display only trainer name
   - `name_expertise`: Display name and headline/expertise areas (from LinkedIn)
   - `full`: Display name, bio (headline + manual bio), and photo
2. **Default Behavior**: If share level not configured, default to `name_only`
3. **Single Connection**: Each trainer can only connect one LinkedIn profile (Decision 8)
   - If trainer attempts to connect new profile, show confirmation and replace existing connection

### FR-5: Data Refresh Mechanism
1. **Manual Refresh**: Provide UI button/action for trainer to refresh LinkedIn data on-demand
2. **Automatic Refresh**: Refresh LinkedIn data **once per week** (Decision 5)
   - Scheduled background job runs weekly
   - Only refreshes profiles with `auto_refresh_enabled = true`
   - Minimal frequency to respect LinkedIn API rate limits
3. **Refresh Logging**: Log refresh attempts and results for debugging
4. **Token Refresh**: Automatically refresh expired access tokens using refresh token before API calls

### FR-6: Error Handling
1. **OAuth Failures**: Handle cases where trainer denies OAuth authorization or authorization fails
2. **Token Expiration**: Handle expired access tokens by automatically refreshing using refresh token
3. **API Limits**: Handle LinkedIn API rate limiting with exponential backoff retry logic
4. **Network Errors**: Handle network timeouts and connection failures
5. **Invalid Profile**: Handle cases where LinkedIn profile ID is invalid or profile doesn't exist
6. **Missing Fields**: Handle cases where specific fields are not available (Decision 6 - Standard Placeholders):
   - Photo: Fallback to default avatar or trainer initials
   - Headline: Allow manual entry; if not available, show placeholder "Professional Trainer"
   - Name: If not available, show placeholder "Your Trainer" or course trainer name
   - Bio: Show placeholder "Professional Trainer" if neither LinkedIn headline nor manual bio available
7. **API Permission Errors**: Handle cases where required permissions are not granted
8. **Free Tier Limitations**: Clearly communicate that only basic profile info is available (not full work history/education)
9. **Photo Download Failures**: If photo download fails, use LinkedIn photo URL directly as fallback, then default avatar

## Technical Requirements

### TR-1: LinkedIn Data Extraction Method
**Decision: LinkedIn Official API with Free/Community Tier Access**

We will use LinkedIn's Official API with free Community tier access. This requires:
- OAuth 2.0 three-legged authentication flow
- Trainer consent and authorization
- Use of free tier API endpoints only

**Available Data with Free/Community API Access:**
Based on LinkedIn's Community API (free tier), the following profile information is available:

1. **Profile Basic Information** (via `/identityMe` endpoint or Profile API with `r_liteprofile` permission):
   - ✅ **First Name** (`localizedFirstName`)
   - ✅ **Last Name** (`localizedLastName`)
   - ✅ **Profile Photo** (`profilePicture.displayImage~.elements[].identifiers[0].identifier`)
   - ✅ **Headline** (`headline`) - Professional headline/tagline
   - ✅ **Profile URL** (`vanityName` or profile URL)
   - ✅ **Profile ID** (`id`)

2. **NOT Available with Free Tier** (requires paid/partner access):
   - ❌ Full work experience history (`r_fullprofile` permission)
   - ❌ Education history
   - ❌ Skills and endorsements
   - ❌ Recommendations
   - ❌ Profile summary/About section
   - ❌ Contact information (email, phone)
   - ❌ Connections count

**OAuth Requirements:**
- Use LinkedIn OAuth 2.0 authorization flow
- Request minimum required permissions (e.g., `r_liteprofile` or `r_profile_basicinfo`)
- Store OAuth tokens securely (refresh token for long-term access)
- Handle token refresh automatically

**API Endpoints to Use:**
- Profile Information: `/v2/people/(id:~{id})` or `/identityMe`
- Profile Photo: Available in profile response or via `/v2/people/(id:~{id})/profilePicture`

**Rate Limits:**
- Free tier has rate limits (check current LinkedIn API documentation)
- Implement rate limit handling and retry logic
- Cache responses to minimize API calls

### TR-2: Photo Storage
1. **Decision**: Use **Supabase Storage** for trainer photos (Decision 3)
2. **Implementation**:
   - Download photo from LinkedIn API after extraction
   - Upload to Supabase Storage bucket: `trainer-photos`
   - Generate public URL for the uploaded photo
   - Store public URL in `trainer_photo_url` field
3. **Photo Formats**: Support common image formats (JPEG, PNG, WebP)
4. **Photo Naming**: Use format: `{trainer_id}_{course_id}_{timestamp}.{ext}` or `{trainer_id}_{linkedin_id}.{ext}`
5. **Storage Bucket Setup**:
   - Create Supabase Storage bucket: `trainer-photos`
   - Set public read access for bucket
   - Configure file size limits (max 5MB recommended)
6. **Fallback**: If photo download fails, store LinkedIn photo URL directly, then fallback to default avatar

### TR-3: Database Schema Updates
The existing `ai_coach_trainer_personalization` table may need updates:

**Current Fields:**
- `linkedin_profile_url` (TEXT, nullable) - Already exists
- `trainer_info` (JSONB) - Already exists

**Required Updates:**
- Add `trainer_photo_url` (TEXT, nullable) - Supabase Storage public URL path to trainer photo
- Add `linkedin_data_extracted_at` (TIMESTAMP, nullable) - When LinkedIn data was last extracted
- Add `linkedin_extraction_status` (VARCHAR) - 'pending', 'oauth_pending', 'success', 'failed', 'token_expired'
- Add `linkedin_extraction_error` (TEXT, nullable) - Error message if extraction failed
- Add `linkedin_access_token` (TEXT, nullable) - Encrypted LinkedIn OAuth access token (application-level encryption, Decision 7)
- Add `linkedin_refresh_token` (TEXT, nullable) - Encrypted LinkedIn OAuth refresh token (application-level encryption, Decision 7)
- Add `linkedin_token_expires_at` (TIMESTAMP, nullable) - When access token expires
- Add `linkedin_profile_id` (VARCHAR, nullable) - LinkedIn profile ID (numeric ID)
- Add `trainer_bio` (TEXT, nullable) - Manual bio entry to supplement LinkedIn headline (Decision 9)
- Add `auto_refresh_enabled` (BOOLEAN, default: false) - Enable automatic weekly refresh (Decision 5)

**Optional Updates:**
- Add `last_refreshed_at` (TIMESTAMP, nullable) - Last successful refresh timestamp
- Add `linkedin_oauth_state` (VARCHAR, nullable) - OAuth state parameter for CSRF protection
- Add `encryption_key_identifier` (VARCHAR, nullable) - Identifier for encryption key used (if multiple keys supported)

### TR-4: API/Service Integration
1. **LinkedIn OAuth Service**: Create service to handle OAuth flow
   - Service name: `LinkedInOAuthService` or similar
   - Methods:
     - `initiateOAuth(trainerId, courseId)`: Generate OAuth authorization URL
     - `handleOAuthCallback(code, state)`: Exchange code for tokens
     - `refreshAccessToken(refreshToken)`: Refresh expired access token
     - `revokeToken(accessToken)`: Revoke token if needed

2. **LinkedIn Data Extraction Service**: Create service to extract profile data
   - Service name: `LinkedInDataExtractionService` or similar
   - Methods:
     - `getProfileData(accessToken)`: Get full profile data using access token
     - `extractName(profileData)`: Extract and combine first/last name
     - `extractHeadline(profileData)`: Extract professional headline
     - `extractPhotoUrl(profileData)`: Extract profile photo URL
     - `extractProfileUrl(profileData)`: Extract profile URL/vanity name
   - Error handling for all extraction methods
   - Rate limit handling and retry logic

3. **OAuth Token Storage**:
   - Store access token and refresh token securely using **application-level encryption** (Decision 7)
   - Encrypt tokens before storing in database using AES-256 or similar standard encryption
   - Store encryption key in configuration (`app.config.local.js` or environment variable)
   - Add fields to database: `linkedin_access_token` (encrypted TEXT), `linkedin_refresh_token` (encrypted TEXT), `linkedin_token_expires_at`
   - Decrypt tokens when needed for API calls
   - Implement automatic token refresh before expiration

4. **LinkedIn API Client Configuration**:
   - LinkedIn App credentials (Client ID, Client Secret) - stored in `config/app.config.local.js` (Decision 1)
   - OAuth redirect URI: `https://{domain}/auth/linkedin/callback` - configured in LinkedIn app and config file (Decision 2)
   - Required scopes/permissions: `r_liteprofile` or `r_profile_basicinfo` (minimum required)
   - Configuration location: `app.config.local.js` with fields:
     - `LINKEDIN_CLIENT_ID`
     - `LINKEDIN_CLIENT_SECRET`
     - `LINKEDIN_REDIRECT_URI`
   - Also support environment variables for production deployments

### TR-5: UI Components
1. **Trainer Personalization Form**: 
   - Add LinkedIn URL input field
   - Add "Refresh from LinkedIn" button
   - Display extracted data preview
   - Allow manual override of extracted data

2. **Coach Page Header/Sidebar**:
   - Trainer photo component (circular avatar with fallback)
   - Trainer name display
   - Trainer bio display (if share level permits)
   - LinkedIn profile link (if available)

### TR-6: Background Jobs (Optional)
1. **Scheduled Refresh Job**: 
   - Run periodically (weekly/monthly)
   - Refresh LinkedIn data for all trainers with `auto_refresh_enabled = true`
   - Log results and notify trainers of updates

## Non-Functional Requirements

### NFR-1: Performance
- LinkedIn data extraction should not block UI interactions
- Extraction should complete within 30 seconds (with timeout handling)
- Coach page should load trainer information within 1 second

### NFR-2: Reliability
- System must handle LinkedIn API/service failures gracefully
- Coach page must function even if LinkedIn data is unavailable
- Fallback to manually entered data if extraction fails

### NFR-3: Privacy & Security
- LinkedIn URLs must be validated to prevent malicious links
- Trainer photos and personal information must be handled according to privacy policies
- Share level controls must be enforced
- LinkedIn profile access must respect privacy settings

### NFR-4: Scalability
- Solution must work for multiple trainers (10+)
- LinkedIn data extraction must not cause rate limiting issues
- Photo storage must be scalable

### NFR-5: Compliance
- Solution must comply with LinkedIn's Terms of Service
- Solution must comply with data protection regulations (GDPR, etc.)
- Trainer consent must be obtained before displaying information

## Data Flow

### Flow 1: Initial Trainer Setup with LinkedIn OAuth
```
1. Trainer clicks "Connect with LinkedIn" button in personalization form
2. System generates OAuth state token and stores it
3. System redirects trainer to LinkedIn authorization page
4. Trainer grants required permissions (r_liteprofile or r_profile_basicinfo)
5. LinkedIn redirects back with authorization code
6. System exchanges authorization code for access token and refresh token
7. System stores encrypted tokens in database
8. System calls LinkedIn API with access token to get profile data
9. System extracts name, headline, photo from API response
10. System stores extracted data in database
11. Coach page displays extracted information
```

### Flow 2: Manual Refresh
```
1. Trainer clicks "Refresh from LinkedIn" button (only if OAuth connected)
2. System shows loading state
3. System checks if access token is expired
4. If expired, system uses refresh token to get new access token
5. If refresh token expired, system requests re-authorization
6. System calls LinkedIn API with access token to get latest profile data
7. System extracts updated name, headline, photo
8. System updates database with new data
9. System shows success/failure message
10. Coach page updates with new information
```

### Flow 3: Display on Coach Page
```
1. Learner opens coach page
2. System loads trainer personalization data
3. System checks share level
4. System displays appropriate information:
   - If name_only: Show name only
   - If name_expertise: Show name + expertise
   - If full: Show name + bio + photo
5. System handles missing data gracefully (fallback)
```

## UI/UX Requirements

### UX-1: Trainer Personalization Form
- **LinkedIn Connection**: 
  - "Connect with LinkedIn" button (primary action)
  - Opens LinkedIn OAuth flow
  - Shows connection status (connected/not connected)
  - Displays trainer's LinkedIn profile name when connected
  - **Single Connection**: If trainer already has connection, show "Reconnect" option with confirmation (Decision 8)
  
- **Manual LinkedIn URL Input** (Optional/Fallback): 
  - Text input field labeled "LinkedIn Profile URL (optional)"
  - Placeholder: "https://www.linkedin.com/in/your-profile"
  - Help text: "Or enter manually if OAuth is not preferred"
  - Validation feedback: Show error if URL format is invalid
  
- **OAuth Status**: 
  - Show connection status: "Connected" / "Not Connected"
  - Show last sync time if connected
  - "Disconnect" button to revoke OAuth access
  - Show auto-refresh status: "Automatic refresh: Weekly" (Decision 5)
  
- **Refresh Button**: 
  - Button labeled "Refresh from LinkedIn"
  - Only enabled if LinkedIn is connected via OAuth
  - Loading state while refreshing
  - Success/error message after refresh
  
- **Manual Bio Entry** (Decision 9):
  - Text area field labeled "Bio (Optional - supplements LinkedIn headline)"
  - Placeholder: "Enter additional information about yourself..."
  - Help text: "This will be displayed along with your LinkedIn headline"
  - Character limit: 500 characters recommended
  
- **Data Preview**: 
  - Show extracted name, headline, photo in preview
  - Show manual bio if entered
  - Note: "LinkedIn headline shown (full bio not available on free tier). You can add a manual bio above."
  - Allow editing of extracted data (manual override)

### UX-2: Coach Page Display
- **Trainer Section**:
  - Location: Coach page header or prominent sidebar section
  - Trainer photo: Circular avatar (80-100px), fallback to initials or default avatar
  - Trainer name: Prominent display (heading or large text)
  - Trainer bio: Smaller text below name (if share level permits)
  - LinkedIn link: Small link/icon to LinkedIn profile (optional)

- **Responsive Design**:
  - Mobile: Stack trainer info vertically
  - Desktop: Display horizontally in header/sidebar

### UX-3: Error States
- **OAuth Denied**: Show message: "LinkedIn authorization was denied. Please try again and grant the required permissions."
- **OAuth Failed**: Show message: "Failed to connect with LinkedIn. Please try again or enter information manually."
- **Token Expired**: Show message: "LinkedIn connection expired. Please reconnect to refresh your information."
- **API Error**: Show message: "Could not fetch data from LinkedIn API. Please try refreshing or contact support."
- **Rate Limited**: Show message: "LinkedIn API rate limit reached. Please try again later. (Automatic refresh: Weekly)"
- **Network Error**: Show message: "Connection error. Please check your internet connection and try again."
- **Profile Not Found**: Show message: "LinkedIn profile not found. Please verify your profile URL or reconnect."
- **Missing Data** (Decision 6): Show standard placeholders:
  - Photo: Default avatar icon
  - Name: "Your Trainer"
  - Bio: "Professional Trainer"

## Edge Cases

### EC-1: Trainer Removes or Deletes LinkedIn Profile
- Handle case where LinkedIn profile is deleted/deactivated
- API will return error when accessing deleted profile
- Show appropriate error message: "LinkedIn profile not found or has been removed"
- Allow manual data entry as fallback
- Option to disconnect LinkedIn connection

### EC-2: OAuth Token Expiration
- Handle expired access tokens automatically
- Use refresh token to obtain new access token
- If refresh token is also expired, require trainer to re-authorize
- Show notification if re-authorization is needed

### EC-3: Multiple Trainers per Course
- Display primary trainer information
- Or allow selection of which trainer's information to show
- Or show all trainers (if multiple)

### EC-4: Trainer Revokes OAuth Access
- Handle case where trainer revokes OAuth access from LinkedIn settings
- Detect on next API call (will return 401 Unauthorized)
- Show notification: "LinkedIn connection has been revoked. Please reconnect."
- Provide "Reconnect with LinkedIn" button
- Preserve existing manual data (bio, photo if downloaded) until reconnected
- Use standard placeholders for missing LinkedIn data (Decision 6)

### EC-5: Headline Not Available (Empty Field)
- Some LinkedIn profiles may not have headline set
- Show fallback: Use manual bio if available, otherwise "Professional Trainer" placeholder (Decision 6)
- Display message: "Headline not set on LinkedIn profile. You can add a manual bio above."
- Encourage trainer to enter manual bio to supplement missing headline

### EC-6: Photo URL Becomes Invalid
- Detect broken photo URLs (if using LinkedIn URL directly as fallback)
- Attempt to refresh photo from LinkedIn API
- Fallback to default avatar or trainer initials if refresh fails (Decision 6)
- Note: Photos stored in Supabase Storage should not expire - only LinkedIn URLs may expire

## Success Criteria

1. ✅ Trainers can provide LinkedIn URL and have information automatically extracted
2. ✅ Trainer name, bio, and photo are displayed on coach page
3. ✅ System handles LinkedIn extraction failures gracefully
4. ✅ Share level controls are respected
5. ✅ Coach page loads trainer information quickly
6. ✅ Manual refresh functionality works correctly
7. ✅ System complies with LinkedIn Terms of Service and privacy regulations

## Dependencies

1. **LinkedIn App Registration** (Decision 1): 
   - Admin will register LinkedIn app at https://www.linkedin.com/developers/apps
   - Obtain Client ID and Client Secret
   - Configure OAuth redirect URI: `https://{domain}/auth/linkedin/callback` (Decision 2)
   - Request necessary permissions (r_liteprofile or r_profile_basicinfo)
   - Store credentials in `config/app.config.local.js`:
     - `LINKEDIN_CLIENT_ID`
     - `LINKEDIN_CLIENT_SECRET`
     - `LINKEDIN_REDIRECT_URI`

2. **OAuth Implementation**: 
   - Implement OAuth 2.0 three-legged flow
   - Set up OAuth callback handler
   - Implement token storage and encryption
   - Implement token refresh mechanism

3. **LinkedIn API Client**: 
   - Set up LinkedIn API client/library
   - Implement rate limiting and retry logic
   - Handle API errors and edge cases

4. **Photo Storage** (Decision 3): 
   - Set up Supabase Storage bucket: `trainer-photos`
   - Configure bucket with public read access
   - Implement photo download from LinkedIn API
   - Implement photo upload to Supabase Storage
   - Generate public URLs for stored photos
   - Handle photo update/replacement when LinkedIn data refreshes

5. **Database Migration**: 
   - Update `ai_coach_trainer_personalization` table schema
   - Add OAuth token fields (encrypted with application-level encryption - Decision 7)
   - Add extraction status fields
   - Add `trainer_bio` field for manual bio entry (Decision 9)
   - Add `auto_refresh_enabled` field (default: false, Decision 5)

6. **UI Components**: 
   - Create trainer personalization form with OAuth flow
   - Create coach page display components
   - Implement OAuth callback page

7. **Background Jobs**: 
   - Set up scheduled jobs for automatic token refresh (before expiration)
   - Set up scheduled weekly job for profile data refresh (Decision 5)
   - Job runs once per week for all trainers with `auto_refresh_enabled = true`
   - Log refresh results and notify trainers of updates if needed

## Out of Scope (Future Enhancements)

- ~~Automatic background refresh of LinkedIn data~~ (Now in scope - weekly refresh implemented)
- Support for other social profiles (Twitter, GitHub, etc.)
- Trainer analytics based on LinkedIn profile data
- Integration with LinkedIn Learning certifications
- Team/trainer directory page showing all trainers
- Multiple LinkedIn connections per trainer (explicitly not supported - Decision 8)

## Configuration & Implementation Decisions

### Decision 1: LinkedIn App Registration
- **Status**: Admin will complete LinkedIn app registration and obtain Client ID and Client Secret
- **Configuration Location**: LinkedIn credentials should be stored in `config/app.config.local.js`:
  ```javascript
  LINKEDIN_CLIENT_ID: 'your-client-id-here',
  LINKEDIN_CLIENT_SECRET: 'your-client-secret-here',
  LINKEDIN_REDIRECT_URI: 'https://your-domain.com/auth/linkedin/callback'
  ```
- **Environment Variables**: Also support loading from environment variables:
  - `LINKEDIN_CLIENT_ID`
  - `LINKEDIN_CLIENT_SECRET`
  - `LINKEDIN_REDIRECT_URI`

### Decision 2: OAuth Redirect URI
- **Format**: `https://{your-domain}/auth/linkedin/callback`
- **Example**: `https://app.example.com/auth/linkedin/callback`
- **Requirements**:
  - Must be HTTPS (LinkedIn requirement)
  - Must match exactly what's configured in LinkedIn app settings
  - Should be a dedicated route that handles OAuth callback and token exchange
- **Configuration**: Set this in LinkedIn app settings during registration and in `app.config.local.js`

### Decision 3: Photo Storage
- **Decision**: Use **Supabase Storage** for trainer photos
- **Implementation**:
  - Download photo from LinkedIn API after extraction
  - Upload to Supabase Storage bucket (e.g., `trainer-photos`)
  - Store file path in `trainer_photo_url` field
  - Generate public URL for display
- **Bucket Setup**: Create Supabase Storage bucket named `trainer-photos` with public read access

### Decision 4: Privacy Compliance
- **Privacy Statement**: "We do not share data with third party"
- **Consent**: OAuth authorization serves as consent for data extraction and display
- **Data Usage**: Trainer data extracted from LinkedIn will only be used for:
  - Display on AI Coach page
  - Personalization of AI responses
  - Internal course management
- **No Third-Party Sharing**: Trainer data will not be shared with third parties

### Decision 5: Refresh Frequency
- **Manual Refresh**: Always available on-demand via "Refresh from LinkedIn" button
- **Automatic Refresh**: **Once per week** (minimal frequency to respect rate limits)
- **Implementation**: Scheduled background job runs weekly to refresh all connected LinkedIn profiles
- **Configurable**: Per-trainer setting to enable/disable automatic refresh

### Decision 6: Fallback Strategy
- **Decision**: Use **standard placeholders** when LinkedIn data is unavailable
- **Placeholders**:
  - Photo: Default avatar/icon or trainer initials in circular badge
  - Name: "Your Trainer" or course-assigned trainer name if available
  - Bio: Generic message like "Professional Trainer" or empty if not available
- **Priority**: LinkedIn data > Manual entry > Standard placeholders

### Decision 7: Token Encryption
- **Decision**: Use **application-level encryption** (easier option)
- **Implementation**:
  - Encrypt tokens before storing in database using application encryption library
  - Decrypt tokens when needed for API calls
  - Store encryption key securely in configuration (not in database)
- **Encryption Method**: AES-256 encryption or similar standard method
- **Key Storage**: Store encryption key in `app.config.local.js` or environment variable

### Decision 8: Multiple LinkedIn Connections
- **Decision**: **NO** - Each trainer can only connect **one LinkedIn profile**
- **Implementation**:
  - When trainer connects new LinkedIn profile, disconnect/replace existing connection
  - Show confirmation dialog before replacing existing connection
  - Prevent multiple simultaneous LinkedIn connections per trainer

### Decision 9: Manual Bio Entry
- **Decision**: **YES** - Allow trainers to manually enter a longer bio that supplements the headline
- **Implementation**:
  - Extract headline from LinkedIn (limited to free tier)
  - Allow trainer to enter additional bio text manually
  - Display: LinkedIn headline + manual bio (if provided)
  - If only LinkedIn headline exists, use that; if manual bio exists, prioritize manual bio or show both

## References

- Existing `ai_coach_trainer_personalization` table schema
- LinkedIn API documentation (if using official API)
- Privacy regulations (GDPR, CCPA)
- Existing trainer personalization setup guide: `docs/AI_COACH_TRAINER_PERSONALIZATION_SETUP.md`

---

**Document Version**: 1.0  
**Created**: 2025-01-29  
**Status**: Requirements Only - No Implementation

