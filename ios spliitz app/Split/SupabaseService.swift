//
//  SupabaseService.swift
//  Split
//
//  Central service for all Supabase API calls
//

import Foundation
import Supabase

class SupabaseService {
    static let shared = SupabaseService()
    
    private let supabase = SupabaseManager.shared
    
    private init() {}
    
    // MARK: - User Info
    
    func getUserInfo(userId: UUID) async throws -> UserInfo? {
        let response: UserInfo = try await supabase.client
            .from("user_info")
            .select()
            .eq("user_id", value: userId)
            .single()
            .execute()
            .value
        return response
    }
    
    func updateProfile(userId: UUID, update: UpdateUserInfo) async throws {
        try await supabase.client
            .from("user_info")
            .update(update)
            .eq("user_id", value: userId)
            .execute()
    }
    
    func removeProfilePicture(userId: UUID) async throws {
        try await supabase.client
            .from("user_info")
            .update(["profile_picture": AnyJSON.null])
            .eq("user_id", value: userId)
            .execute()
    }
    
    func checkEmailExists(email: String) async throws -> Bool {
        let response: [UserInfo] = try await supabase.client
            .from("user_info")
            .select("user_id")
            .eq("email", value: email)
            .execute()
            .value
        return !response.isEmpty
    }
    
    func checkUsernameExists(username: String) async throws -> Bool {
        let response: [UserInfo] = try await supabase.client
            .from("user_info")
            .select("user_id")
            .eq("username", value: username)
            .execute()
            .value
        return !response.isEmpty
    }
    
    func getEmailForUsername(username: String) async throws -> String? {
        struct EmailResponse: Decodable {
            let email: String
        }
        
        // Note: This relies on RLS allowing reading of emails. 
        // If emails are private, this approach might need a customized Postgres function or Edge Function 
        // that takes a username and returns whether it exists + an indirect way to sign in, 
        // BUT standard practice for "login with username" often implies the backend can resolve it.
        // For this app's schema, we assume we can query it.
        let response: EmailResponse = try await supabase.client
            .from("user_info")
            .select("email")
            .eq("username", value: username)
            .single()
            .execute()
            .value
        
        return response.email
    }
    
    func sendPasswordResetEmail(email: String) async throws {
        try await supabase.auth.resetPasswordForEmail(email)
    }
    
    // MARK: - Friends
    
    func searchUsers(query: String) async throws -> [UserInfo] {
        let cleanQuery = query.replacingOccurrences(of: ",", with: "")
        let response: [UserInfo] = try await supabase.client
            .from("user_info")
            .select("user_id, first_name, last_name, email, username, profile_picture")
            .or("email.ilike.%\(cleanQuery)%,username.ilike.%\(cleanQuery)%")
            .limit(10)
            .execute()
            .value
        return response
    }
    
    func getFriends(userId: UUID) async throws -> [UserInfo] {
        // Get friend entries where current user is id_1 OR id_2
        let entries: [FriendEntry] = try await supabase.client
            .from("friend_list")
            .select("id_1, id_2")
            .or("id_1.eq.\(userId),id_2.eq.\(userId)")
            .execute()
            .value
        
        guard !entries.isEmpty else { return [] }
        
        // Extract friend IDs (batch)
        let friendIds = entries.map { entry -> String in
            (entry.id1 == userId) ? entry.id2.uuidString : entry.id1.uuidString
        }
        
        // Batch fetch all friends in one query
        let friends: [UserInfo] = try await supabase.client
            .from("user_info")
            .select()
            .in("user_id", values: friendIds)
            .execute()
            .value
        
        // Deduplicate friends by ID
        let uniqueFriends = Array(Dictionary(grouping: friends, by: { $0.id })
            .compactMap { $0.value.first })
            .sorted { $0.fullName < $1.fullName } // Sort for consistent UI
            
        return uniqueFriends
    }
    
    func getPendingFriendRequests(userId: UUID) async throws -> [(request: FriendRequest, sender: UserInfo)] {
        // Fetch ALL rows involving the user to handle both incoming (id_2) and potential legacy/inverted (id_1) logic.
        let requests: [FriendRequest] = try await supabase.client
            .from("friend_request")
            .select("id_1, id_2")
            .or("id_1.eq.\(userId),id_2.eq.\(userId)")
            .execute()
            .value
        
        print("DEBUG: Fetching requests for user \(userId)")
        print("DEBUG: Raw requests found: \(requests.count)")
        
        guard !requests.isEmpty else { return [] }
        
        // Collect other user IDs (the person who is NOT me)
        let otherIds = requests.map { request -> String in
            return (request.id1 == userId) ? request.id2.uuidString : request.id1.uuidString
        }
        
        // Batch fetch other users
        let others: [UserInfo] = try await supabase.client
            .from("user_info")
            .select()
            .in("user_id", values: otherIds)
            .execute()
            .value
        
        // Map by ID
        let userMap = Dictionary(uniqueKeysWithValues: others.map { ($0.id, $0) })
        
        let allRequests = requests.compactMap { request -> (request: FriendRequest, sender: UserInfo)? in
            // Determine who is the "other" person
            let otherId = (request.id1 == userId) ? request.id2 : request.id1
            guard let otherUser = userMap[otherId] else { return nil }
            
            return (request: request, sender: otherUser)
        }
        
        // Deduplicate by sender ID (handle potential DB double-entries)
        let uniqueRequests = Dictionary(grouping: allRequests, by: { $0.sender.id })
            .compactMap { $0.value.first }
            
        return uniqueRequests
    }
    
    // Fetch all friends and calculate net balance for each
    func fetchFriendsAndBalances(userId: UUID) async throws -> [(friend: UserInfo, balance: Double)] {
        // 1. Fetch all friends
        let friends = try await getFriends(userId: userId)
        guard !friends.isEmpty else { return [] }
        
        // 2. Fetch ALL dues involving me (as payer or ower)
        // Note: We need a custom query to get dues where id_1=me OR id_2=me
        struct Due: Decodable {
            let id1: UUID
            let id2: UUID
            let amount: Int
            let received: Bool
            
            enum CodingKeys: String, CodingKey {
                case id1 = "id_1"
                case id2 = "id_2"
                case amount
                case received
            }
        }
        
        let dues: [Due] = try await supabase.client
            .from("dues")
            .select("id_1, id_2, amount, received")
            .or("id_1.eq.\(userId),id_2.eq.\(userId)")
            .execute()
            .value
            
        // 3. Calculate balance per friend
        var balanceMap: [UUID: Double] = [:]
        
        for due in dues {
            // If received is true, balance is settled, so ignore
            if due.received { continue }
            
            let otherId = (due.id1 == userId) ? due.id2 : due.id1
            let amount = Double(due.amount) / 100.0
            
            // If I am id_1 (payer), they owe me (+).
            // If I am id_2 (ower), I owe them (-).
            let impact = (due.id1 == userId) ? amount : -amount
            
            balanceMap[otherId, default: 0] += impact
        }
        
        // 4. Map back to friends
        return friends.map { friend in
            (friend: friend, balance: balanceMap[friend.id] ?? 0)
        }
    }
    
    func sendFriendRequest(fromUserId: UUID, toUserId: UUID) async throws {
        // 1. Check for blocks
        let blocks: [BlockEntry] = try await supabase.client
            .from("block_list")
            .select("id_1, id_2")
            .or("and(id_1.eq.\(fromUserId),id_2.eq.\(toUserId)),and(id_1.eq.\(toUserId),id_2.eq.\(fromUserId))")
            .execute()
            .value
        
        if !blocks.isEmpty {
            throw NSError(domain: "Friends", code: -1, userInfo: [NSLocalizedDescriptionKey: "Cannot send friend request - blocked"])
        }
        
        // 2. Check if already friends
        let existingFriend: [FriendEntry] = try await supabase.client
            .from("friend_list")
            .select("id_1, id_2")
            .or("and(id_1.eq.\(fromUserId),id_2.eq.\(toUserId)),and(id_1.eq.\(toUserId),id_2.eq.\(fromUserId))")
            .execute()
            .value
            
        if !existingFriend.isEmpty {
            throw NSError(domain: "Friends", code: -1, userInfo: [NSLocalizedDescriptionKey: "You are already friends"])
        }
        
        // 3. Check for existing pending request (in either direction)
        let existingRequest: [FriendRequest] = try await supabase.client
            .from("friend_request")
            .select("id_1, id_2")
            .or("and(id_1.eq.\(fromUserId),id_2.eq.\(toUserId)),and(id_1.eq.\(toUserId),id_2.eq.\(fromUserId))")
            .execute()
            .value
            
        if !existingRequest.isEmpty {
             throw NSError(domain: "Friends", code: -1, userInfo: [NSLocalizedDescriptionKey: "Friend request already sent/pending"])
        }
        
        // 4. Send request (id_1 = sender, id_2 = receiver)
        try await supabase.client
            .from("friend_request")
            .insert(["id_1": fromUserId.uuidString, "id_2": toUserId.uuidString])
            .execute()
            
        // 5. Create Notification
        Task {
            // Get sender info for message
            if let sender = try? await getUserInfo(userId: fromUserId) {
                let name = sender.fullName
                await createActivity(
                    userId: toUserId,
                    type: .friendRequest,
                    title: "New Friend Request",
                    message: "\(name) sent you a friend request",
                    relatedId: fromUserId // Link to the sender
                )
            }
        }
    }
    
    func respondToFriendRequest(requesterId: UUID, requesteeId: UUID, accept: Bool) async throws {
        if accept {
            let id1 = requesterId.uuidString < requesteeId.uuidString ? requesterId : requesteeId
            let id2 = requesterId.uuidString < requesteeId.uuidString ? requesteeId : requesterId
            
            // Add to friend list (sorted)
            try await supabase.client
                .from("friend_list")
                .insert([
                    "id_1": id1.uuidString, "id_2": id2.uuidString
                ])
                .execute()
                
            // Notify the requester that I accepted
            Task {
                if let responder = try? await getUserInfo(userId: requesteeId) {
                     await createActivity(
                        userId: requesterId,
                        type: .friends,
                        title: "Friend Request Accepted",
                        message: "\(responder.fullName) accepted your friend request",
                        relatedId: requesteeId
                    )
                }
            }
        }
        
        // Delete the request (try both directions to be safe, or just sorted if request table also has constraint)
        // Assuming request table might not strictly enforce sorting yet, but let's try strict first based on user request.
        // Actually for requests, usually it's directional (sender -> receiver).
        // If user enforced id1<id2 on requests too, then we must sort.
        // Assuming user meant "friend_list" and "block_list" as per prompt. "friend_request" usually implies direction.
        // However, looking at my code, I previously did `id_1 = requesterId`. If the constraint is on `friend_request` too, I should sort.
        // User prompt: "I added the constraint to friend_list and block_list so that id_1<id_2".
        // It does NOT mention friend_request. So I will keep friend_request directional.
        // Delete the request. Since we now enforce id_1=Sender, id_2=Receiver,
        // we delete exactly that match.
        // Delete the request.
        // We attempt to delete BOTH directions to be absolutely sure we catch the row.
        // using try? to ensure if one fails (e.g. due to potential RLS or missing row), it continues to try the other.
        
        // Direction 1: id_1 = requester, id_2 = requestee (Standard)
        // We try strictly first.
        _ = try? await supabase.client
            .from("friend_request")
            .delete()
            .match(["id_1": requesterId.uuidString, "id_2": requesteeId.uuidString])
            .execute()
        
        // Direction 2: id_1 = requestee, id_2 = requester (Legacy/Inverted)
        _ = try? await supabase.client
            .from("friend_request")
            .delete()
            .match(["id_1": requesteeId.uuidString, "id_2": requesterId.uuidString])
            .execute()
    }
    
    func removeFriend(userId: UUID, friendId: UUID) async throws {
        try await supabase.client
            .from("friend_list")
            .delete()
            .or("and(id_1.eq.\(userId),id_2.eq.\(friendId)),and(id_1.eq.\(friendId),id_2.eq.\(userId))")
            .execute()
    }
    
    func blockFriend(userId: UUID, friendId: UUID) async throws {
        // Remove from friend list
        try await removeFriend(userId: userId, friendId: friendId)
        
        // Remove any pending requests
        try await supabase.client
            .from("friend_request")
            .delete()
            .or("and(id_1.eq.\(userId),id_2.eq.\(friendId)),and(id_1.eq.\(friendId),id_2.eq.\(userId))")
            .execute()
        
        // Add to block list (sorted)
        let id1 = userId.uuidString < friendId.uuidString ? userId : friendId
        let id2 = userId.uuidString < friendId.uuidString ? friendId : userId
        
        try await supabase.client
            .from("block_list")
            .insert(["id_1": id1.uuidString, "id_2": id2.uuidString])
            .execute()
    }
    
    // MARK: - Groups
    
    func getUserGroups(userId: UUID) async throws -> [GroupWithInfo] {
        let response: [GroupWithInfo] = try await supabase.client
            .from("split_groups")
            .select("group_id, invite, group_info(group_id, group_title, description, owner_id)")
            .eq("user_id", value: userId)
            .eq("invite", value: false)
            .execute()
            .value
        return response
    }
    
    func getGroupInvites(userId: UUID) async throws -> [GroupWithInfo] {
        let response: [GroupWithInfo] = try await supabase.client
            .from("split_groups")
            .select("group_id, invite, group_info(group_id, group_title, description)")
            .eq("user_id", value: userId)
            .eq("invite", value: true)
            .execute()
            .value
        return response
    }
    
    func createGroup(title: String, description: String?, ownerId: UUID) async throws -> GroupInfo {
        let groupId = UUID()
        
        // Create group_info
        let groupInfo = CreateGroupInfo(
            groupId: groupId,
            groupTitle: title,
            description: description,
            ownerId: ownerId
        )
        
        try await supabase.client
            .from("group_info")
            .insert(groupInfo)
            .execute()
        
        // Add owner to groups table
        try await supabase.client
            .from("split_groups")
            .insert([
                "user_id": ownerId.uuidString,
                "group_id": groupId.uuidString,
                "invite": "false"
            ])
            .execute()
        
        return GroupInfo(id: groupId, groupTitle: title, description: description, ownerId: ownerId)
    }
    
    func updateGroup(groupId: UUID, title: String, description: String?) async throws {
        try await supabase.client
            .from("group_info")
            .update([
                "group_title": title,
                "description": description ?? ""
            ])
            .eq("group_id", value: groupId)
            .execute()
    }
    
    func deleteGroup(groupId: UUID, userId: UUID) async throws {
        // Verify ownership
        let info: GroupInfo = try await supabase.client
            .from("group_info")
            .select("group_id, owner_id")
            .eq("group_id", value: groupId)
            .single()
            .execute()
            .value
        
        guard info.ownerId == userId else {
            throw NSError(domain: "Groups", code: -1, userInfo: [NSLocalizedDescriptionKey: "Only the owner can delete this group"])
        }
        
        // Get expense IDs for this group
        let expenses: [ExpenseInfo] = try await supabase.client
            .from("expense_info")
            .select("expense_id")
            .eq("group_id", value: groupId)
            .execute()
            .value
        
        let expenseIds = expenses.map { $0.id.uuidString }
        
        // Delete expense assignments
        if !expenseIds.isEmpty {
            try await supabase.client
                .from("expense")
                .delete()
                .in("expense_id", values: expenseIds)
                .execute()
        }
        
        // Delete expense info
        try await supabase.client
            .from("expense_info")
            .delete()
            .eq("group_id", value: groupId)
            .execute()
        
        // Delete group memberships
        try await supabase.client
            .from("split_groups")
            .delete()
            .eq("group_id", value: groupId)
            .execute()
        
        // Delete group info
        try await supabase.client
            .from("group_info")
            .delete()
            .eq("group_id", value: groupId)
            .execute()
    }
    
    func getGroupMembers(groupId: UUID) async throws -> [UserInfo] {
        let memberships: [GroupMembership] = try await supabase.client
            .from("split_groups")
            .select("user_id, group_id, invite")
            .eq("group_id", value: groupId)
            .eq("invite", value: false)
            .execute()
            .value
        
        guard !memberships.isEmpty else { return [] }
        
        // Batch fetch all member info in one query
        let memberIds = memberships.map { $0.userId.uuidString }
        let members: [UserInfo] = try await supabase.client
            .from("user_info")
            .select()
            .in("user_id", values: memberIds)
            .execute()
            .value
        
        return members
    }
    
    func inviteFriendToGroup(userId: UUID, groupId: UUID) async throws {
        // Check if already exists
        let existing: [GroupMembership] = try await supabase.client
            .from("split_groups")
            .select("user_id, group_id, invite")
            .eq("group_id", value: groupId)
            .eq("user_id", value: userId)
            .execute()
            .value
        
        if !existing.isEmpty {
            throw NSError(domain: "Groups", code: -1, userInfo: [NSLocalizedDescriptionKey: "User already in group or invited"])
        }
        
        try await supabase.client
            .from("split_groups")
            .insert([
                "group_id": groupId.uuidString,
                "user_id": userId.uuidString,
                "invite": "true"
            ])
            .execute()
            
        // Notify the invitee
        Task {
            // Get group title? We need to fetch group info or pass it.
            // Fetching for safety
            struct GroupTitle: Decodable { let group_title: String }
            let group: GroupTitle? = try? await supabase.client
                .from("group_info")
                .select("group_title")
                .eq("group_id", value: groupId)
                .single()
                .execute()
                .value
            
            let title = group?.group_title ?? "a group"
            
            await createActivity(
                userId: userId,
                type: .groupInvite,
                title: "Group Invite",
                message: "You have been invited to join '\(title)'",
                relatedId: groupId
            )
        }
    }
    
    func respondToGroupInvite(userId: UUID, groupId: UUID, accept: Bool) async throws {
        if accept {
            try await supabase.client
                .from("split_groups")
                .update(["invite": false])
                .eq("group_id", value: groupId)
                .eq("user_id", value: userId)
                .execute()
        } else {
            try await supabase.client
                .from("split_groups")
                .delete()
                .eq("group_id", value: groupId)
                .eq("user_id", value: userId)
                .execute()
        }
    }
    
    func removeMemberFromGroup(userId: UUID, groupId: UUID, currentUserId: UUID) async throws {
        // Verify ownership
        let info: GroupInfo = try await supabase.client
            .from("group_info")
            .select("group_id, owner_id")
            .eq("group_id", value: groupId)
            .single()
            .execute()
            .value
        
        guard info.ownerId == currentUserId else {
            throw NSError(domain: "Groups", code: -1, userInfo: [NSLocalizedDescriptionKey: "Only the owner can remove members"])
        }
        
        guard userId != info.ownerId else {
            throw NSError(domain: "Groups", code: -1, userInfo: [NSLocalizedDescriptionKey: "Cannot remove the owner"])
        }
        
        try await supabase.client
            .from("split_groups")
            .delete()
            .eq("group_id", value: groupId)
            .eq("user_id", value: userId)
            .execute()
    }
    
    // MARK: - Expenses
    
    func fetchMonthlyTotal(userId: UUID) async throws -> Double {
        // Query 'expense' table directly to get only MY share
        // Join with 'expense_info' to filter by date and proposal status
        
        struct ExpenseSplit: Decodable {
            let individualAmount: Int?
            
            enum CodingKeys: String, CodingKey {
                case individualAmount = "individual_amount"
            }
        }
        
        let calendar = Calendar.current
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: Date()))!
        let startDateStr = ISO8601DateFormatter().string(from: startOfMonth)
        
        let response: [ExpenseSplit] = try await supabase.client
            .from("expense")
            .select("individual_amount, expense_info!inner(date, proposal)")
            .eq("user_id", value: userId)
            .eq("expense_info.proposal", value: false) // Only count finalized expenses
            .gte("expense_info.date", value: startDateStr)
            .execute()
            .value
        
        let totalCents = response.reduce(0) { $0 + ($1.individualAmount ?? 0) }
        return Double(totalCents) / 100.0
    }
    
    // Fetch expenses for a specific month window (for Calendar)
    func fetchExpensesForCalendar(userId: UUID, start: Date, end: Date) async throws -> [ExpenseInfo] {
        let groups = try await getUserGroups(userId: userId)
        let groupIds = groups.map { $0.groupId.uuidString }
        
        guard !groupIds.isEmpty else { return [] }
        
        let formatter = ISO8601DateFormatter()
        
        // Fetch expenses where due_date is within the range
        // Note: due_date is optional, so we check for not null implicitly by the range query usually, but Supabase might need explicit handling.
        // We'll just fetch based on range.
        
        let expenses: [ExpenseInfo] = try await supabase.client
            .from("expense_info")
            .select("*")
            .in("group_id", values: groupIds)
            .gte("due_date", value: formatter.string(from: start))
            .lte("due_date", value: formatter.string(from: end))
            .execute()
            .value
            
        return expenses
    }
    
    // Update expense info (for editing pending expenses)
    func updateExpenseInfo(expenseId: UUID, title: String, amount: Int, explanation: String?) async throws {
        struct UpdatePayload: Encodable {
            let title: String
            let total_amount: Int
            let explanation: String?
        }
        
        let payload = UpdatePayload(title: title, total_amount: amount, explanation: explanation)
        
        try await supabase.client
            .from("expense_info")
            .update(payload)
            .eq("expense_id", value: expenseId)
            .execute()
    }
    
    func fetchPendingProposals(userId: UUID) async throws -> [ExpenseWithInfo] {
        let response: [ExpenseWithInfo] = try await supabase.client
            .from("expense")
            .select("expense_id, individual_amount, approval, expense_info(expense_id, title, total_amount, proposal, group_id, payer_id)")
            .eq("user_id", value: userId)
            // .eq("approval", value: false) // Allow seeing approved but pending proposals
            .execute()
            .value
        
        // Filter to only proposals
        return response.filter { $0.expenseInfo?.proposal == true }
    }
    
    func getGroupExpenses(groupId: UUID) async throws -> [ExpenseInfo] {
        let response: [ExpenseInfo] = try await supabase.client
            .from("expense_info")
            .select("expense_id, title, explanation, total_amount, payer_id, date, proposal, due_date")
            .eq("group_id", value: groupId)
            .eq("proposal", value: false) // Only finalized expenses
            .order("date", ascending: false)
            .limit(15)
            .execute()
            .value
        return response
    }
    
    func getGroupPendingExpenses(groupId: UUID, userId: UUID) async throws -> [ExpenseWithInfo] {
        let response: [ExpenseWithInfo] = try await supabase.client
            .from("expense")
            .select("expense_id, individual_amount, approval, expense_info(expense_id, title, due_date, group_id, proposal, payer_id, total_amount)")
            .eq("user_id", value: userId)
            // .eq("approval", value: false)
            .execute()
            .value
        
        // Filter to only this group AND only if proposal is true
        return response.filter { 
            $0.expenseInfo?.groupId == groupId && 
            $0.expenseInfo?.proposal == true 
        }
    }
    
    // Fetch breakdown of who is paying what for a specific expense
    func fetchExpenseSplits(expenseId: UUID) async throws -> [(user: UserInfo, amount: Int)] {
        // 1. Get the splits from 'expense' table
        let expenses: [Expense] = try await supabase.client
            .from("expense")
            .select()
            .eq("expense_id", value: expenseId)
            .execute()
            .value
        
        guard !expenses.isEmpty else { return [] }
        
        // 2. Batch fetch all users in one query
        let userIds = expenses.map { $0.userId.uuidString }
        let users: [UserInfo] = try await supabase.client
            .from("user_info")
            .select()
            .in("user_id", values: userIds)
            .execute()
            .value
        
        // 3. Map users by ID for efficient lookup
        let userMap = Dictionary(uniqueKeysWithValues: users.map { ($0.id, $0) })
        
        return expenses.compactMap { expense in
            guard let user = userMap[expense.userId] else { return nil }
            return (user: user, amount: expense.individualAmount ?? 0)
        }
    }
    
    func createExpense(
        groupId: UUID,
        title: String,
        totalAmount: Int,
        payerId: UUID?,
        dueDate: Date?,
        period: Int?,
        explanation: String?,
        splits: [(userId: UUID, amount: Int)]
    ) async throws {
        let expenseId = UUID()
        
        // Create expense_info
        let expenseInfo = CreateExpenseInfo(
            expenseId: expenseId,
            title: title,
            explanation: explanation,
            totalAmount: totalAmount,
            payerId: payerId,
            dueDate: dueDate,
            proposal: true,
            groupId: groupId,
            period: period
        )
        
        try await supabase.client
            .from("expense_info")
            .insert(expenseInfo)
            .execute()
        
        // Get current user ID (creator)
        guard let currentUserId = supabase.auth.currentUser?.id else {
            throw NSError(domain: "Auth", code: -1, userInfo: [NSLocalizedDescriptionKey: "User not logged in"])
        }

        // Create expense entries for each split
        let expenseEntries = splits.map { split in
            CreateExpense(
                expenseId: expenseId,
                userId: split.userId,
                individualAmount: split.amount,
                approval: split.userId == currentUserId // Auto-approve if user is the creator
            )
        }
        
        try await supabase.client
            .from("expense")
            .insert(expenseEntries)
            .execute()
            
        // Notify split participants
        Task {
            // Who created it? currentUserId
            let creatorName = (try? await getUserInfo(userId: currentUserId))?.fullName ?? "Someone"
            
            // Filter out creator from splits
            let recipients = splits.filter { $0.userId != currentUserId }
            
            if !recipients.isEmpty {
                // Get group name if relevant
                var context = ""
                 struct GroupTitle: Decodable { let group_title: String }
                 if let group = try? await supabase.client
                    .from("group_info")
                    .select("group_title")
                    .eq("group_id", value: groupId)
                    .single()
                    .execute()
                    .value as GroupTitle {
                     context = " in '\(group.group_title)'"
                 }
                
                // Notify each recipient
                for split in recipients {
                     await createActivity(
                        userId: split.userId,
                        type: .expenseProposed,
                        title: "New Expense",
                        message: "\(creatorName) added an expense\(context)",
                        relatedId: expenseId // Deep link to expense
                    )
                }
            }
        }
    }

    func updateExpense(
        expenseId: UUID,
        title: String,
        totalAmount: Int,
        payerId: UUID?,
        dueDate: Date?,
        period: Int?,
        explanation: String?,
        splits: [(userId: UUID, amount: Int)]
    ) async throws {
        
        // 1. Update expense_info
        _ = CreateExpenseInfo(
            expenseId: expenseId,
            title: title,
            explanation: explanation,
            totalAmount: totalAmount,
            payerId: payerId,
            dueDate: dueDate,
            proposal: true, // Reset to proposal since it changed
            groupId: UUID(), // Placeholder, not updated in DB via insert struct usually, but let's check update payload
            period: period
        )
        // We need a specific Update struct or dictionary, CreateExpenseInfo might fail if used for update
        // Let's use a dictionary or specific update struct
        struct UpdateExpensePayload: Encodable {
            let title: String
            let total_amount: Int
            let explanation: String?
            let payer_id: UUID?
            let due_date: Date?
            let period: Int?
            let proposal: Bool
        }
        
        let updatePayload = UpdateExpensePayload(
            title: title,
            total_amount: totalAmount,
            explanation: explanation,
            payer_id: payerId,
            due_date: dueDate,
            period: period,
            proposal: true
        )
        
        try await supabase.client
            .from("expense_info")
            .update(updatePayload)
            .eq("expense_id", value: expenseId)
            .execute()
            
        // 2. Delete existing expense entries (the splits)
        try await supabase.client
            .from("expense")
            .delete()
            .eq("expense_id", value: expenseId)
            .execute()
        
        // 3. Re-create splits
        guard let currentUserId = supabase.auth.currentUser?.id else { return }
        
        let expenseEntries = splits.map { split in
            CreateExpense(
                expenseId: expenseId,
                userId: split.userId,
                individualAmount: split.amount,
                approval: split.userId == currentUserId // Auto-approve creator
            )
        }
        
        try await supabase.client
            .from("expense")
            .insert(expenseEntries)
            .execute()
            
        // 4. Delete associated dues (since Amount changed, old dues are invalid if it was previously finalized)
        // If it was a proposal, there were no dues yet. If it was finalized (proposal=false), we are resetting it to true, so dues should be gone.
        try await supabase.client
            .from("dues")
            .delete()
            .eq("expense_id", value: expenseId)
            .execute()
    }
    
    func deleteExpense(expenseId: UUID) async throws {
        // Delete from expense_info (cascade should handle expense entries and dues if configured, otherwise we delete manually)
        // Assuming cascade for now, or just deleting entries first.
        
        // Delete dues
        try await supabase.client
            .from("dues")
            .delete()
            .eq("expense_id", value: expenseId)
            .execute()
            
        // Delete splits
        _ = try await supabase.client
            .from("expense")
            .delete()
            .eq("expense_id", value: expenseId)
            .execute()
        
        // Due to foreign key constraints, deleting expense_info should cascade.
        // But for safety/completeness we can rely on DB cascade or manual delete.
        // Assuming DB cascade is ON for expense_id referencers.
        try await supabase.client
            .from("expense_info")
            .delete()
            .eq("expense_id", value: expenseId)
            .execute()
    }

    func fetchMonthlyMySpend(userId: UUID) async throws -> Double {
        // 1. Sum cost of expenses I paid for (my share)
        // 2. Sum cost of dues I owe (my share)
        // Basically: Sum of all `expense` (splits) where user_id = me, within current month
        
        // Get current month range
        let calendar = Calendar.current
        let now = Date()
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: now))!
        let endOfMonth = calendar.date(byAdding: .month, value: 1, to: startOfMonth)!
        
        let formatter = ISO8601DateFormatter()
        let startStr = formatter.string(from: startOfMonth)
        let endStr = formatter.string(from: endOfMonth)
        
        // We join expense_info to filter by date
        struct ExpenseSplitAmount: Decodable {
            let individualAmount: Int
            enum CodingKeys: String, CodingKey { case individualAmount = "individual_amount" }
        }
        
        let response: [ExpenseSplitAmount] = try await supabase.client
            .from("expense")
            .select("individual_amount, expense_info!inner(due_date)")
            .eq("user_id", value: userId)
            // Filter by date range on the joined expense_info table
            .gte("expense_info.due_date", value: startStr)
            .lt("expense_info.due_date", value: endStr)
            .execute()
            .value
            
        let totalCents = response.reduce(0) { $0 + $1.individualAmount }
        return Double(totalCents) / 100.0
    }
    
    func fetchUpcomingDues(userId: UUID) async throws -> [Due] {
        // Fetch dues where I owe (id2=me) AND paid=false
        // Ordered by due_date (ascending)
        // Limit to next 30 days
        
        let calendar = Calendar.current
        let today = Date()
        let thirtyDaysLater = calendar.date(byAdding: .day, value: 30, to: today)!
        let formatter = ISO8601DateFormatter()
        
        // Note: expense_info!inner(*) fetches the related expense info
        let response: [Due] = try await supabase.client
            .from("dues")
            .select("*, expense_info!inner(*)")
            .eq("id_2", value: userId)
            .eq("paid", value: false)
            .gte("expense_info.due_date", value: formatter.string(from: today))
            .lte("expense_info.due_date", value: formatter.string(from: thirtyDaysLater))
            .execute()
            .value
        
        // Sort in memory since foreignTable order might not be supported
        return response.sorted { ($0.expenseInfo?.dueDate ?? Date.distantFuture) < ($1.expenseInfo?.dueDate ?? Date.distantFuture) }
    }

    func fetchUnpaidDues(userId: UUID, start: Date, end: Date) async throws -> [Due] {
        let formatter = ISO8601DateFormatter()
        let startStr = formatter.string(from: start)
        let endStr = formatter.string(from: end)
        
        let response: [Due] = try await supabase.client
            .from("dues")
            .select("*, expense_info!inner(*)")
            .eq("id_2", value: userId)
            .eq("paid", value: false)
            .gte("expense_info.due_date", value: startStr)
            .lte("expense_info.due_date", value: endStr)
            .execute()
            .value
        
        // Sort in memory since foreignTable order might not be supported
        return response.sorted { ($0.expenseInfo?.dueDate ?? Date.distantFuture) < ($1.expenseInfo?.dueDate ?? Date.distantFuture) }
    }
    
    // MARK: - Dues
    
    struct Due: Codable, Identifiable {
        var id: UUID { expenseId } // unique by expense
        let id1: UUID // Payer
        let id2: UUID // Ower
        let expenseId: UUID
        let amount: Int // In cents
        var paid: Bool
        var received: Bool
        
        // Joins
        let expenseInfo: ExpenseInfo?
        
        enum CodingKeys: String, CodingKey {
            case id1 = "id_1"
            case id2 = "id_2"
            case expenseId = "expense_id"
            case amount
            case paid
            case received
            case expenseInfo = "expense_info"
        }
    }
    
    // Fetch all transactions involving these two users
    func fetchDues(user1: UUID, user2: UUID) async throws -> [Due] {
        // We want all rows where (id1=u1 AND id2=u2) OR (id1=u2 AND id2=u1)
        // PostgREST "or" syntax: or=(and(id_1.eq.u1,id_2.eq.u2),and(id_1.eq.u2,id_2.eq.u1))
        
        let response: [Due] = try await supabase.client
            .from("dues")
            .select("*, expense_info(*)")
            .or("and(id_1.eq.\(user1),id_2.eq.\(user2)),and(id_1.eq.\(user2),id_2.eq.\(user1))")
            .execute()
            .value
            
        return response
    }
    
    func approveExpense(expenseId: UUID, userId: UUID) async throws {
        // 1. Mark expense entry as approved
        try await supabase.client
            .from("expense")
            .update(["approval": true])
            .eq("expense_id", value: expenseId)
            .eq("user_id", value: userId)
            .execute()
            
        // 2. Check if all members have approved, and if so, finalize
        try await checkAndFinalizeExpense(expenseId: expenseId)
    }
    
    private func checkAndFinalizeExpense(expenseId: UUID) async throws {
        // Check if there are any unapproved entries for this expense
        struct ApprovalStatus: Decodable {
            let approval: Bool
        }
        
        let unapproved: [ApprovalStatus] = try await supabase.client
            .from("expense")
            .select("approval")
            .eq("expense_id", value: expenseId)
            .eq("approval", value: false)
            .execute()
            .value
            
        if unapproved.isEmpty {
            // All approved! Finalize the proposal.
            try await supabase.client
                .from("expense_info")
                .update(["proposal": false])
                .eq("expense_id", value: expenseId)
                .execute()
                
            // Calculate and insert dues
            try await calculateAndInsertDues(expenseId: expenseId)
        }
    }
    
    private func calculateAndInsertDues(expenseId: UUID) async throws {
        // 1. Fetch Payer
        let info: ExpenseInfo = try await supabase.client
            .from("expense_info")
            .select()
            .eq("expense_id", value: expenseId)
            .single()
            .execute()
            .value
            
        guard let payerId = info.payerId else { return }
        
        #if DEBUG
        print("DEBUG: Calculating dues for expense \(expenseId)")
        print("DEBUG: Payer ID: \(payerId)")
        #endif
        
        // 2. Fetch Splits
        let splits: [Expense] = try await supabase.client
            .from("expense")
            .select() // Select ALL columns
            .eq("expense_id", value: expenseId)
            .execute()
            .value
            
        #if DEBUG
        print("DEBUG: Found \(splits.count) splits")
        #endif
        
        // 3. Prepare Dues
        struct CreateDue: Encodable {
            let id_1: UUID
            let id_2: UUID
            let expense_id: UUID
            let amount: Int
            let paid: Bool
            let received: Bool
        }
        
        var dues: [CreateDue] = []
        
        for split in splits {
            #if DEBUG
            print("DEBUG: Processing split for user \(split.userId). Amount (cents): \(split.individualAmount ?? -1)")
            #endif
            
            // Skip if payer is the one split (paying themselves)
            // Also ensure we don't create debt for the payer
            if split.userId == payerId { 
                #if DEBUG
                print("DEBUG: Skipping payer")
                #endif
                continue 
            }
            
            let amountInt = split.individualAmount ?? 0
            #if DEBUG
            print("DEBUG: Calculated due amount: \(amountInt)")
            #endif
            
            // id_1 = Payer, id_2 = Ower
            let due = CreateDue(
                id_1: payerId,
                id_2: split.userId,
                expense_id: expenseId,
                amount: amountInt,
                paid: false,
                received: false
            )
            dues.append(due)
        }
        
        // 4. Insert Dues
        if !dues.isEmpty {
            #if DEBUG
            print("DEBUG: Inserting \(dues.count) dues records")
            #endif
            try await supabase.client
                .from("dues")
                .insert(dues)
                .execute()
        } else {
            #if DEBUG
            print("DEBUG: No dues to insert")
            #endif
        }
    }
    
    func reconcileDues(groupId: UUID) async throws {
        #if DEBUG
        print("DEBUG: Starting reconcileDues for group \(groupId)")
        #endif
        
        // ----------------------------------------------------------------
        // 1. Self-Heal Pending Approvals
        // Check if any "pending" expenses are actually fully approved but missed the trigger
        // ----------------------------------------------------------------
        struct ExpenseID: Decodable { let expenseId: UUID; enum CodingKeys: String, CodingKey { case expenseId = "expense_id" } }
        
        let pendingExpenses: [ExpenseID] = try await supabase.client
            .from("expense_info")
            .select("expense_id")
            .eq("group_id", value: groupId)
            .eq("proposal", value: true) // Check pending ones
            .execute()
            .value
            
        if !pendingExpenses.isEmpty {
            #if DEBUG
            print("DEBUG: Found \(pendingExpenses.count) PENDING expenses. Checking for missed finalizations...")
            #endif
            for expense in pendingExpenses {
                // This function checks if all members approved, and if so, sets proposal=false + creates dues
                try await checkAndFinalizeExpense(expenseId: expense.expenseId)
            }
        }
        
        // ----------------------------------------------------------------
        // 2. Self-Heal Missing Dues
        // Check finalized expenses (proposal=false) that have NO dues entries
        // ----------------------------------------------------------------
        let finalizedExpenses: [ExpenseID] = try await supabase.client
            .from("expense_info")
            .select("expense_id")
            .eq("group_id", value: groupId)
            .eq("proposal", value: false)
            .execute()
            .value
            
        let expenseIds = finalizedExpenses.map { $0.expenseId }
        #if DEBUG
        print("DEBUG: Found \(expenseIds.count) finalized expenses (proposal=false)")
        #endif
        
        guard !expenseIds.isEmpty else { return }
        
        // Check which ones have dues
        // We can't easily do "NOT IN" query style for array, so we fetch existing dues for these expenses
        struct DueID: Decodable { let expenseId: UUID; enum CodingKeys: String, CodingKey { case expenseId = "expense_id" } }
        
        let existingDues: [DueID] = try await supabase.client
            .from("dues")
            .select("expense_id")
            .in("expense_id", values: expenseIds)
            .execute()
            .value
            
        let expensesWithDues = Set(existingDues.map { $0.expenseId })
        let missingDues = expenseIds.filter { !expensesWithDues.contains($0) }
        
        #if DEBUG
        print("DEBUG: Expenses with existing dues: \(expensesWithDues.count)")
        print("DEBUG: Expenses MISSING dues: \(missingDues.count)")
        #endif
        
        if !missingDues.isEmpty {
            print("Reconciling dues: Found \(missingDues.count) expenses missing dues.")
            for expenseId in missingDues {
                #if DEBUG
            print("DEBUG: Reconciling expense \(expenseId)")
            #endif
                try await calculateAndInsertDues(expenseId: expenseId)
            }
        }
    }
    
    // MARK: - Dues Payment Flow
    
    func markDuesAsPaid(userId: UUID, friendId: UUID) async throws {
        // Net Settlement Logic:
        // 1. Mark my debts to friend as PAID
        // 2. Mark friend's debts to me as PAID and RECEIVED (offset)
        
        print("DEBUG: markDuesAsPaid (Net Settlement) called. Me: \(userId), Friend: \(friendId)")
        
        struct DueID: Decodable { let expenseId: UUID; enum CodingKeys: String, CodingKey { case expenseId = "expense_id" } }
        
        // 1. Mark my debts as paid
        let myDebtsUpdated: [DueID] = try await supabase.client
            .from("dues")
            .update(["paid": true])
            .eq("id_2", value: userId) // I owe
            .eq("id_1", value: friendId) // Friend is payer
            .eq("paid", value: false)
            .select()
            .execute()
            .value
            
        print("DEBUG: Updated \(myDebtsUpdated.count) of my debts to PAID")
        
        // 2. Mark friend's debts as paid AND received (offset)
        // We mark them as 'paid' (by them, implicitly) and 'received' (by me)
        let friendDebtsUpdated: [DueID] = try await supabase.client
            .from("dues")
            .update([
                "paid": true,
                "received": true
            ])
            .eq("id_2", value: friendId) // Friend owes
            .eq("id_1", value: userId) // I am payer
            // We update open checks. Even if they marked it valid, we confirm receipt now.
            // If received is already true, no need to update, but usually it's false here.
            .eq("received", value: false) 
            .select()
            .execute()
            .value

        print("DEBUG: Updated \(friendDebtsUpdated.count) of friend's debts to PAID & RECEIVED")
        
        // Notify the recipient (friend)
        Task {
            if let payer = try? await getUserInfo(userId: userId) {
                 await createActivity(
                    userId: friendId,
                    type: .duesPaid,
                    title: "Payment Sent",
                    message: "\(payer.fullName) settled the net balance. Please confirm receipt.",
                    relatedId: userId // Link to payer profile
                )
            }
        }
    }
    
    func confirmDueReceipt(expenseId: UUID, owerId: UUID) async throws {
        try await supabase.client
            .from("dues")
            .update(["received": true])
            .eq("expense_id", value: expenseId)
            .eq("id_2", value: owerId)
            .execute()
    }

    // MARK: - Storage
    
    func uploadProfilePicture(userId: UUID, data: Data) async throws -> String {
        let fileName = "\(userId.uuidString)-\(Int(Date().timeIntervalSince1970)).jpg"
        
        // Upload
        let _ = try await supabase.client.storage
            .from("profile_pictures")
            .upload(fileName, data: data, options: FileOptions(cacheControl: "3600", upsert: false))
            
        return fileName // Return path to be stored in DB
    }
    
    func getProfilePictureURL(path: String) async throws -> URL {
        return try await supabase.client.storage
            .from("profile_pictures")
            .createSignedURL(path: path, expiresIn: 3600)
    }
    func claimExpensePayer(expenseId: UUID, payerId: UUID) async throws {
        // 1. Update payer_id in expense_info
        try await supabase.client
            .from("expense_info")
            .update(["payer_id": payerId.uuidString])
            .eq("expense_id", value: expenseId)
            .execute()
            
        // 2. Recalculate and insert dues
        // This will delete existing dues for this expense (if any, though likely none if payer was nil) and create new ones based on the new payer.
        // We first delete existing dues just in case.
        try await supabase.client
            .from("dues")
            .delete()
            .eq("expense_id", value: expenseId)
            .execute()
            
        try await calculateAndInsertDues(expenseId: expenseId)
    }
    
    func fetchPendingProposalsCount(userId: UUID) async throws -> Int {
        // We use "head: true" and "count: .exact" to get the count without data
        // Filter: user_id=me AND approval=false AND expense_info.proposal=true
        // Note: Filtering on joined table requires !inner hint if we start from 'expense'
        let response = try await supabase.client
            .from("expense")
            .select("expense_id, expense_info!inner(proposal)", head: true, count: CountOption.exact)
            .eq("user_id", value: userId)
            // .eq("approval", value: false) // Count all active proposals
            .eq("expense_info.proposal", value: true)
            .execute()
        
        return response.count ?? 0
    }
    
    func fetchCalendarEventsCount(userId: UUID, start: Date, end: Date) async throws -> Int {
        let groups = try await getUserGroups(userId: userId)
        let groupIds = groups.map { $0.groupId.uuidString }
        
        guard !groupIds.isEmpty else { return 0 }
        
        let formatter = ISO8601DateFormatter()
        
        // Count expenses in range
        let response = try await supabase.client
            .from("expense_info")
            .select("expense_id", head: true, count: CountOption.exact)
            .in("group_id", values: groupIds)
            .eq("proposal", value: false) // Only finalized expenses
            .gte("due_date", value: formatter.string(from: start))
            .lte("due_date", value: formatter.string(from: end))
            .execute()
            
        return response.count ?? 0
    }
    
    // MARK: - Activities (formerly Notifications)
    
    func fetchActivities(userId: UUID) async throws -> [Activity] {
        let response: [Activity] = try await supabase.client
            .from("activities")
            .select()
            .eq("user_id", value: userId)
            .order("created_at", ascending: false)
            .limit(50)
            .execute()
            .value
        return response
    }
    
    func markAllActivitiesAsRead(userId: UUID) async throws {
        try await supabase.client
            .from("activities")
            .update(["is_read": true])
            .eq("user_id", value: userId)
            .eq("is_read", value: false)
            .execute()
    }
    
    func createActivity(userId: UUID, type: ActivityType, title: String, message: String, relatedId: UUID?) async {
        // defined as non-throwing (fire and forget pattern) to not block main actions
        DebugLogger.shared.log("Attempting to create activity for user \(userId) type: \(type)")
        
        // 1. Get Configuration from Matrix
        let config = getActivityConfig(type: type)
        
        // 2. Logic: is_read
        // User Requirement: "is_read is not set to true for iphone push notifications... if they can't connect... they won't be able to see"
        // Decision: ALWAYS default is_read to FALSE. 
        // This ensures badges/feed items exist until viewed.
        
        let payload = CreateActivity(
            userId: userId,
            type: type,
            title: title,
            message: message,
            relatedId: relatedId
        )
        
        // 3. iPhone Push Logic
        if config.iphone {
            DebugLogger.shared.log("Triggering iPhone Push for \(type) (This would typically happen via DB triggers or Edge Function)")
            // In a real app, this DB insert likely triggers the Push via Supabase Edge Functions.
            // We just ensure the row is inserted with the correct type.
        }
        
        do {
            try await supabase.client
                .from("activities")
                .insert(payload)
                .execute()
            DebugLogger.shared.log("Activity created successfully")
        } catch {
            DebugLogger.shared.log("Failed to create activity: \(error)")
        }
    }
    
    func testActivity(userId: UUID) async {
        // Test function to trigger both iPhone and Activity types
        await createActivity(
            userId: userId,
            type: .test,
            title: "Test Notification",
            message: "This is a test of the iPhone and Activity Feed routing.",
            relatedId: nil
        )
    }
    
    // Matrix Configuration Helper
    private func getActivityConfig(type: ActivityType) -> (iphone: Bool, inApp: Bool, activity: Bool) {
        switch type {
        case .duesPaid:        return (iphone: true, inApp: true, activity: false)
        case .expenseProposed: return (iphone: true, inApp: true, activity: false)
        case .expenseFinalized: return (iphone: true, inApp: false, activity: true)
        case .friendRequest:   return (iphone: true, inApp: true, activity: false)
        case .paymentDueCustom: return (iphone: true, inApp: false, activity: false)
        case .paymentConfirmed: return (iphone: false, inApp: false, activity: true) // "When you Confirm... activity"
        case .friends:          return (iphone: false, inApp: false, activity: true) // "When you are friends"
        case .paymentDue7Days:  return (iphone: false, inApp: true, activity: false)
        case .groupInvite:      return (iphone: true, inApp: true, activity: false)
        case .joinedGroup:      return (iphone: false, inApp: false, activity: true)
        case .test:             return (iphone: true, inApp: true, activity: true) // Enable all for test
        }
    }
}
