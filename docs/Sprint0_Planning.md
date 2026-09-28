# Sprint 0 - Initial Project Definition

## 1. Project Overview

### Problem

Planning a night out with friends can take a lot of time because people have different budgets, preferences, transport options and ideas about what they want to do.

Finding suitable places and combining them into one complete plan often requires searching through multiple websites or applications.

### Target Users

The main target users are:

- Students
- Young adults
- Friend groups
- People who want an easy way to plan an evening

The first version of the application will focus on users in **Lleida**.

### Solution

The application allows users to enter information about their night, such as:

- Budget
- Group size
- Preferred activities
- Available time
- Maximum distance
- Available transport or resources
- Additional preferences

Based on this information, the backend filters suitable venues and uses AI to generate a small number of complete night plans.

### Main Value

Instead of manually searching for restaurants, bars, activities and other locations, users receive several complete suggestions based on their own situation and preferences.

### Innovative Component

AI is used to create personalized combinations of real venues instead of simply recommending individual locations.

The backend first filters the available venues using factual information such as price, distance and opening hours.

The AI then combines suitable venues into complete plans.

---

# 2. Expected Key Functionalities

| Functionality | Description |
|---|---|
| Night/Availability preferences | |
| AI plan generation | Server-side AI creates several complete plans using suitable venues. |
| Save plans | Users can save generated plans. |
| Accounts | Users can optionally create accounts for cloud saving and personalization. |
| Plan sharing | Users can share plans through links or directly with other users. |
| Friends | Users can add other users as friends. |
| Groups | Users can create groups for planning nights together. |

---

# 3. Initial Planning

## Sprint 1 - Core Planner

### Planned Functionality

- React Native application setup
- ASP.NET Core backend
- PostgreSQL development database
- Entity Framework Core
- Initial Lleida venue dataset
- Input form
- Resource checkboxes
- Budget and price handling
- Basic distance calculation
- Venue filtering
- Server-side AI integration
- Generate 2-3 plans
- Basic plan saving
- Deployment through Dokploy

---

## Sprint 2 - Accounts and Social Features

### Planned Functionality

- User accounts
- Guest mode improvements
- Cloud saved plans
- Profile preferences
- Personalized recommendations
- Shareable plan links
- Friend system
- Groups
- Group planning
- Voting between plans
- Basic website
- Shared plan web pages

---

## Sprint 3 - Production and Business Features

### Planned Functionality

- Free and premium tiers
- Advanced filters
- Improved saving and history
- Currency translation
- Advertisements
- Advertisement during AI generation
- Venue promotion
- Improved recommendation system
- Better AI prompts
- Website improvements
- UI/UX improvements
- Production database
- Development/production separation
- Testing
- Bug fixing
- Logging and monitoring
- Performance improvements
- Final deployment

---

# 4. Commitment for Sprint 1

By the end of Sprint 1, we commit to having a working version of the core planning functionality.

A user will be able to open the React Native application, enter preferences for a night out, submit these preferences to the ASP.NET Core backend and receive multiple generated plans based on real venue data stored in PostgreSQL.

## Demonstrable Results

By the end of Sprint 1:

- The React Native application runs on Android.
- The user can enter night preferences.
- The user can select available resources using checkboxes.
- The application communicates with the ASP.NET Core backend.
- PostgreSQL contains an initial curated dataset of Lleida venues.
- Entity Framework Core is used for database access.
- The backend can filter unsuitable venues.
- Price information is available.
- Basic distance calculations are available.
- AI generates 2-3 plans.
- Generated plans use venues from the database.
- Generated plans display estimated prices.
- Generated plans display distance information.
- Users can save generated plans.
- The backend is deployed using Dokploy.
- A clearly labelled development database is used.

---

# 5. Initial Technical Approach

## C# + ASP.NET Core - Backend

ASP.NET Core will be used for the main backend and REST API.

### Reasons

- Mature and well-supported ecosystem
- Good support for REST APIs
- Strong typing helps catch mistakes early
- Built-in dependency injection
- Built-in configuration system
- Authentication support
- Works well with Entity Framework Core
- Several team members already have experience with C#

### Responsibilities

The backend will handle:

- Venue data
- User input
- Filtering
- AI communication
- Validation
- Plan generation
- Saving plans
- Accounts
- Groups
- Voting
- Future social functionality

---

## Entity Framework Core - ORM

Entity Framework Core will be used to communicate between the ASP.NET Core backend and PostgreSQL.

### Reasons

- Mature .NET ORM
- Integrates directly with ASP.NET Core
- Good PostgreSQL support
- Supports migrations
- Supports relationships
- Supports LINQ queries
- Reduces the amount of SQL that needs to be written manually
- Existing experience within the team

---

## React Native - Mobile Application

React Native will be used for the mobile application.

### Reasons

- One codebase can support Android and iOS
- Uses React and TypeScript
- React knowledge can also be used for the website
- TypeScript types, API models, validation and utility code can potentially be shared
- Faster than creating separate Android and iOS applications
- Large ecosystem
- Good support for native functionality

The initial school version will primarily target Android.

---

## PostgreSQL - Database

PostgreSQL will be used as the relational database.

### Reasons

- Reliable and mature
- Free and open source
- Good fit for structured relational data
- Works well with Entity Framework Core
- Widely supported by hosting providers
- Supports relationships and constraints

Possible stored data includes:

- Users
- Venues
- Plans
- Plan items
- User preferences
- Groups
- Group members
- Friends
- Votes

---

# 6. AI

## Model

**GPT-6 Luna**

The AI will run on the server rather than directly on the mobile device.

## Why Server-Side

- API keys remain private
- AI provider can be changed without updating the app
- Prompts are managed centrally
- AI usage can be monitored
- Responses can be validated before being sent to the application
- Cost can be controlled from the backend

## AI Flow

1. User submits preferences.
2. Backend retrieves venue data.
3. Backend filters unsuitable venues.
4. Only suitable venues are sent to the AI.
5. AI creates 2-3 plans.
6. Backend validates the response.
7. Plans are returned to the application.

The database remains the source of truth.

The AI should not invent venues.

---

## AI Pricing

Estimated API pricing:

- Input: approximately **$0.10 per 1 million tokens**
- Cached input: approximately **$0.01 per 1 million tokens**
- Output: approximately **$0.50 per 1 million tokens**

### Example Request

Estimated input:

- System instructions: ~500 tokens
- User preferences: ~300 tokens
- Venue information: ~2,000 tokens
- Output schema/context: ~200 tokens

Total:

**~3,000 input tokens**

Estimated AI response:

**~800 output tokens**

### Estimated Cost Per Generation

Input:

`3,000 / 1,000,000 × $0.10 = $0.00030`

Output:

`800 / 1,000,000 × $0.50 = $0.00040`

Estimated total:

**~$0.00070 per generated request**

### Estimated Usage Cost

| Generations | Estimated Cost |
|---:|---:|
| 100 | ~$0.07 |
| 1,000 | ~$0.70 |
| 5,000 | ~$3.50 |
| 10,000 | ~$7.00 |
| 100,000 | ~$70.00 |

Actual costs can vary depending on token usage and reasoning settings.

---

# 7. Infrastructure

## Oracle Cloud VPS

The project already has access to an Oracle Cloud ARM64 VPS.

### Resources

- 4 ARM OCPU
- 24 GB RAM

This is more than sufficient for the expected development and initial production workload.

Possible services running on the VPS:

- ASP.NET Core backend
- PostgreSQL
- Website
- Reverse proxy
- Monitoring
- Additional supporting services

---

## Dokploy

Dokploy is already installed on the VPS.

It will be used for:

- Docker-based deployment
- Application management
- Environment variables
- Domains
- HTTPS/reverse proxy
- Database deployment
- Redeployment

This allows the team to focus on application development rather than building deployment infrastructure from scratch.

---

## Environment Separation

The project will start with a clearly labelled development database.

Example:

```text
project_dev
```

Later, production will use a separate database:

```text
project_prod
```

Development and production environments will remain separated to prevent testing from affecting production data.

---

# 8. Initial Architecture

```text
React Native Application
        |
        | REST / JSON
        v
ASP.NET Core API
        |
        +------------------> AI API
        |
        v
Entity Framework Core
        |
        v
PostgreSQL
```

Later, the website will use the same backend:

```text
React Native App ----\
                      \
                       >---- ASP.NET Core API ---- PostgreSQL
                      /
React Website -------/
                       \
                        ---- AI API
```

---

# 9. Website

A website will also be developed.

The initial website can provide:

- Landing page
- Explanation of the application
- App download/open links
- Shared plan pages

Example:

```text
website.com/plan/ABC123
```

Later, more functionality can be added, such as:

- Accounts
- Plan generation
- User profiles
- Groups

The website will most likely use:

- React
- TypeScript
- Possibly Next.js

---

# 10. Repository

GitHub will be used as the source code repository.

Possible repository structure:

```text
project/
├── app/
├── backend/
├── web/
├── docs/
└── README.md
```

The repository will contain:

- Application source code
- Backend source code
- Website source code
- Documentation
- Setup instructions
- Architecture information

The teaching staff will be given access to the repository.

---

# 11. Project Management Approach

Each sprint will clearly document:

## Planned

What did we plan to complete?

## Completed

What was actually completed?

## Differences

What changed compared with the original plan?

## Explanation

Why did the change happen?

Example:

> Group voting was originally planned for Sprint 2 but was moved to Sprint 3 because integration of the authentication system required more development time than expected.

This makes changes traceable and provides a reason for deviations from the original planning.

---

# 12. Development Sequence

The development order is intentional.

## Sprint 1

The first sprint focuses on the core planner because all later functionality depends on it.

Without a working planner, accounts, groups, voting and monetization provide little value.

## Sprint 2

Once the core planner works, social and account functionality can be added.

These systems depend on a stable backend and database structure.

## Sprint 3

The final sprint focuses on:

- Business functionality
- Premium features
- Monetization
- Production readiness
- Testing
- UI/UX
- Final polish

This reduces the risk of reaching the final weeks without a functioning core application.

---

# 13. Resources and Preliminary Cost Plan

| Resource | Estimated Usage | Unit Cost | Estimated Total |
|---|---:|---:|---:|
| Oracle Cloud VPS | Existing Free Tier | €0/month | €0 |
| Dokploy | Self-hosted | €0 | €0 |
| PostgreSQL | Open source | €0 | €0 |
| ASP.NET Core | Open source | €0 | €0 |
| Entity Framework Core | Open source | €0 | €0 |
| React Native | Open source | €0 | €0 |
| GitHub | Free plan | €0 | €0 |
| Development computers | Already owned | €0 additional | €0 |
| AI API | ~5,000 generations | ~$0.0007/generation | ~$3.50 |
| Development tools | Free/student tools | €0 | €0 |

## Estimated Direct Cost

Approximately:

**€3-€10**

for the development period.

The main variable cost is expected to be AI API usage.

Existing hardware and server infrastructure have no additional direct cost for the project.

---

# 14. Initial Development Risk Assessment

| Development Risk | Why It May Affect the Project | Mitigation |
|---|---|---|
| React Native learning curve | Some team members may have limited experience with React Native or TypeScript. | Start with a small prototype, document project conventions and create reusable components. |
| Frontend-backend integration | The React Native application and ASP.NET Core backend are developed separately and mismatching APIs or models could create integration problems. | Define API contracts early and use Swagger/OpenAPI for documentation and testing. |
| Git merge conflicts | Multiple team members may modify the same code at the same time. | Use feature branches, pull requests, small commits and clear responsibility division. |
| Different development environments | Differences in operating systems, Node versions, .NET SDK versions or dependencies may cause environment-specific problems. | Pin important dependency versions and document the complete development setup. |
| ARM64 deployment compatibility | The Oracle VPS uses ARM64 while development computers may use x86-64. Some dependencies or Docker images may not support ARM64. | Verify ARM64 compatibility before adding dependencies and use multi-architecture Docker images where possible. |
| Team coordination | Parallel development may result in duplicated work or incompatible implementations. | Divide responsibilities clearly, maintain sprint tasks and regularly integrate the complete project. |
| Underestimating Development Time | Tasks may take longer than expected due to unexpected technical problems, integration issues, debugging, or unfamiliar technologies. | Break work into smaller tasks, estimate with extra buffer time, track progress during each sprint, and reprioritize lower-priority features if delays occur. |

---

# 15. Code Quality and Security

From Sprint 1 onwards, the project will include:

## SonarQube

Used for:

- Code quality analysis
- Bugs
- Code smells
- Maintainability
- Security issues

## OWASP ZAP

Used for security analysis of the web component.

These tools will be integrated into the development process rather than only being used at the end of each sprint.
