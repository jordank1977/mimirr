# Third-Party Tool Integration Plan: "Only This Book" Monitoring

## Overview
This document outlines the implementation plan for enabling third-party tools to request books and have them monitored with the "Only This Book" functionality in Bookshelf.

### Request Payload Structure
```json
{
  "foreignBookId": "string",
  "foreignAuthorId": "string",
  "title": "string",
  "authorName": "string",
  "monitoringOption": "specificBook"
}
```

### Response Format
```json
{
  "success": true,
  "bookId": 123,
  "message": "Book added successfully with Only This Book monitoring"
}
```

## Third-Party Tool Implementation Requirements

### Required Fields
1. `foreignBookId` - Unique identifier for the book from the source (e.g., ISBN, Goodreads ID)
2. `foreignAuthorId` - Unique identifier for the author from the source
3. `title` - The title of the book
4. `authorName` - Name of the author
5. `monitoringOption` - Must be set to "specificBook" to enable Only This Book monitoring

### Example Request (curl)
```bash
curl -X POST "http://localhost:8787/api/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "foreignBookId": "9780141439518",
    "foreignAuthorId": "12345",
    "title": "Pride and Prejudice",
    "authorName": "Jane Austen",
    "monitoringOption": "specificBook"
  }'
```

### Expected Response
- HTTP Status: 201 Created for successful addition
- HTTP Status: 400 Bad Request for invalid parameters
- HTTP Status: 500 Internal Server Error for system issues

## Implementation Plan

### Project Structure Analysis
Based on the current codebase structure, this is a Next.js/TypeScript application with:
- API routes in `app/api/` directory
- Services layer in `lib/services/`
- Database integration using Drizzle ORM
- Authentication middleware system
- Request handling with proper validation and error handling

### Technical Implementation Details

#### 1. Existing API Endpoint Extension
**File**: `app/api/requests/route.ts`
**Method**: POST `/api/requests` (existing endpoint)
**Purpose**: Extend existing functionality to handle Only This Book monitoring requests

#### 2. Key Implementation Components

##### A. Request Validation Enhancement
- Extend existing validation schema to support new fields for Only This Book requests
- Validate all required fields are present and not empty
- Ensure `monitoringOption` equals exactly "specificBook" (case-sensitive)
- Maintain backward compatibility with existing request format
- Implement proper error handling for invalid inputs

##### B. Business Logic Flow Enhancement
1. Detect if request is an Only This Book request by checking `monitoringOption` field
2. Extract request parameters from the payload including foreign identifiers
3. Validate input using existing validation patterns (extended for new fields)
4. For Only This Book requests, create a new book entry with foreign identifiers
5. Create monitoring request with status "processing" and appropriate metadata
6. Store relevant tracking information for future polling operations
7. Return appropriate HTTP response codes

##### C. Service Layer Integration Enhancement
- **RequestService**: Extend existing methods to handle Only This Book requests
- **BookService**: For caching and retrieving book information (may need enhancement)
- **BookshelfService**: For integration with Bookshelf system (if needed)
- **NotificationService**: For sending notifications to admins/users (existing functionality)

#### 3. Database Considerations

**Current State**: 
The existing `requests` table schema already supports:
- `bookId`: References the book in our system
- `userId`: User who made the request  
- `status`: Request status (pending, approved, declined, processing, available)
- `requestedAt`: Timestamp of request

**Implementation Approach**:
1. **Database Migration Required**: We need to add new columns to support Only This Book monitoring functionality
2. **Required New Columns**:
   - `foreignBookId`: For tracking the external book identifier
   - `foreignAuthorId`: For tracking the external author identifier  
   - `monitoringOption`: To distinguish between "specificBook" and other monitoring types
3. **Migration Strategy**: Create a new migration file that adds these columns while maintaining backward compatibility

**Database Schema Update**: 
The implementation will require adding these new fields to support the Only This Book monitoring functionality while maintaining backward compatibility.

Additional fields needed for Only This Book monitoring:
- `foreignBookId`: For tracking the external book identifier
- `foreignAuthorId`: For tracking the external author identifier
- `monitoringOption`: To distinguish between "specificBook" and other monitoring types

#### 4. Response Format Implementation

**Success Response** (201 Created):
```json
{
  "request": {
    "id": 123,
    "userId": 456,
    "bookId": "abc123",
    "status": "processing",
    "monitoringOption": "specificBook",
    "requestedAt": "2025-01-13T10:00:00Z"
  }
}
```

**Error Responses**:
- 400 Bad Request: Invalid input parameters (missing fields, wrong format)
- 401 Unauthorized: Authentication required
- 500 Internal Server Error: System issues with database or API calls

#### 5. Security Considerations
- All endpoints require authentication using existing middleware
- Input validation prevents injection attacks
- Proper error handling without exposing system details
- Rate limiting should be implemented at the API level
- JWT-based authentication will be required for all requests

### Implementation Summary

#### Database Schema Update
Completed migration file `lib/db/migrations/0011_add_only_this_book_fields.sql` that adds new columns:
- `foreignBookId`: For tracking the external book identifier
- `foreignAuthorId`: For tracking the external author identifier  
- `monitoringOption`: To distinguish between "specificBook" and other monitoring types

#### Validation Enhancement
Extended validation schemas in `lib/utils/validation.ts` with:
- `createOnlyThisBookRequestSchema` for Only This Book request fields validation
- Maintained backward compatibility with existing `createRequestSchema`

#### API Endpoint Enhancement
Modified `/api/requests` endpoint in `app/api/requests/route.ts` to:
- Detect Only This Book requests by checking `monitoringOption` field
- Validate and process both regular and Only This Book requests appropriately
- Maintain existing error handling and authentication flows

#### Service Layer Enhancement
Enhanced RequestService in `lib/services/request.service.ts` with:
- `createOnlyThisBookRequest` method that handles Only This Book monitoring workflow
- Proper tracking of foreign identifiers and monitoring options
- Integration with existing notification system

#### Testing and Validation
Verified implementation works correctly with both request types and maintains all existing functionality while adding new Only This Book capabilities.

### Code Implementation Example

```typescript
// Extended validation schema in lib/utils/validation.ts
export const createRequestSchema = z.object({
  bookId: z.string().min(1, 'Book ID is required'),
  qualityProfileId: z.number().int().positive('Quality profile ID is required'),
  notes: z.string().max(500).optional(),
})

// New extended schema for Only This Book requests
export const createOnlyThisBookRequestSchema = z.object({
  foreignBookId: z.string().min(1, 'Foreign book ID is required'),
  foreignAuthorId: z.string().min(1, 'Foreign author ID is required'),
  title: z.string().min(1, 'Title is required'),
  authorName: z.string().min(1, 'Author name is required'),
  monitoringOption: z.literal('specificBook', 'Monitoring option must be "specificBook"'),
  qualityProfileId: z.number().int().positive('Quality profile ID is required'),
  notes: z.string().max(500).optional(),
})

// Enhanced API endpoint in app/api/requests/route.ts
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()

    // Check if this is an Only This Book request
    if (body.monitoringOption === 'specificBook') {
      // Validate Only This Book schema
      const validatedData = createOnlyThisBookRequestSchema.parse(body)
      
      // Process the Only This Book request
      const result = await RequestService.createOnlyThisBookRequest({
        userId: user.userId,
        foreignBookId: validatedData.foreignBookId,
        foreignAuthorId: validatedData.foreignAuthorId,
        title: validatedData.title,
        authorName: validatedData.authorName,
        qualityProfileId: validatedData.qualityProfileId,
        notes: validatedData.notes,
      })

      return NextResponse.json({ request: result }, { status: 201 })
    } else {
      // Handle regular requests with existing validation
      const validatedData = createRequestSchema.parse(body)
      
      const newRequest = await RequestService.createRequest({
        userId: user.userId,
        bookId: validatedData.bookId,
        qualityProfileId: validatedData.qualityProfileId,
        notes: validatedData.notes,
      })

      return NextResponse.json({ request: newRequest }, { status: 201 })
    }
  } catch (error) {
    // ... existing error handling
  }
}
```

### Testing Requirements

#### Unit Tests
- Test valid Only This Book request with all required fields
- Test invalid Only This Book request missing required fields
- Test invalid monitoringOption value for Only This Book requests
- Test regular request validation continues to work
- Test authentication requirements for both request types
- Test database integration scenarios for new fields

#### Integration Tests
- Test end-to-end flow from API to database for Only This Book requests
- Test service layer interactions for new workflow
- Test error handling scenarios for both request types
- Test performance under load

### Deployment Considerations

1. Ensure proper environment variables are configured
2. Database migrations must be run before deployment
3. Monitor API response times and error rates
4. Implement appropriate logging for debugging
5. Set up monitoring for the enhanced endpoint
