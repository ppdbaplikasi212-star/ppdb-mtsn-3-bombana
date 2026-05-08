# Security Specification for PPDB MTsN 3 Bombana

## Data Invariants
1. A registrant can only be created by an authenticated user (or publicly if requested, but better to protect it. The prompt says "pendaftaran online", usually public but I'll add basic validation).
2. Only admins can update status or testScheduleId for a registrant.
3. Test schedules can only be modified by admins.
4. Admins can download all data.

## The Dirty Dozen Payloads
1. Create registrant with status: 'Verified' by a non-admin. (DENIED)
2. Update registrant to change fullName by a non-admin. (DENIED)
3. Create admin document by a non-admin. (DENIED)
4. Update test schedule by a non-admin. (DENIED)
5. Delete registrant by a non-admin. (DENIED)
6. Create registrant with missing required fields. (DENIED)
7. Create registrant with invalid NISN (too long). (DENIED)
8. Update registrant to change status by the owner. (DENIED)
9. List all registrants by a non-admin. (DENIED)
10. Create registrant with fake createdAt timestamp. (DENIED)
11. Inject huge string into address field. (DENIED)
12. Change ownerId of a registrant. (DENIED)

## Test Runner
I'll implement the rules next.
