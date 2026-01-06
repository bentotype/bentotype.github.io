//
//  Models.swift
//  Split
//
//  Created by Benjamin Chen on 10/26/25.
//
import SwiftUI
import Supabase
import Foundation

// MARK: - User Models

struct UserInfo: Codable, Identifiable, Hashable {
    let id: UUID
    var username: String?
    var email: String?
    var firstName: String?
    var lastName: String?
    var phoneNumber: String?
    var profilePicture: String?
    
    // Payment usernames
    var venmoUsername: String?
    var paypalUsername: String?
    var cashAppUsername: String?
    
    enum CodingKeys: String, CodingKey {
        case id = "user_id"
        case username, email
        case firstName = "first_name"
        case lastName = "last_name"
        case phoneNumber = "phone_number"
        case profilePicture = "profile_picture"
        case venmoUsername = "venmo_username"
        case paypalUsername = "paypal_username"
        case cashAppUsername = "cashapp_username"
    }
    
    var fullName: String {
        let first = firstName ?? ""
        let last = lastName ?? ""
        let name = "\(first) \(last)".trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? (email ?? "User") : name
    }
    
    var initials: String {
        let first = firstName?.first.map(String.init) ?? ""
        let last = lastName?.first.map(String.init) ?? ""
        let result = "\(first)\(last)".uppercased()
        return result.isEmpty ? "U" : result
    }
}

// For creating new users during signup
struct CreateUserInfo: Codable {
    let userId: UUID
    var username: String
    var email: String
    var firstName: String
    var lastName: String
    var phoneNumber: String?
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username, email
        case firstName = "first_name"
        case lastName = "last_name"
        case phoneNumber = "phone_number"
    }
}

// For updating profile
struct UpdateUserInfo: Codable {
    var firstName: String?
    var lastName: String?
    var username: String?
    var email: String?
    var profilePicture: String?
    
    // Payment usernames
    var venmoUsername: String?
    var paypalUsername: String?
    var cashAppUsername: String?
    
    enum CodingKeys: String, CodingKey {
        case firstName = "first_name"
        case lastName = "last_name"
        case username, email
        case profilePicture = "profile_picture"
        case venmoUsername = "venmo_username"
        case paypalUsername = "paypal_username"
        case cashAppUsername = "cashapp_username"
    }
}

// MARK: - Group Models

struct GroupInfo: Codable, Identifiable, Hashable {
    let id: UUID
    var groupTitle: String?
    var description: String?
    var ownerId: UUID?
    
    enum CodingKeys: String, CodingKey {
        case id = "group_id"
        case groupTitle = "group_title"
        case description
        case ownerId = "owner_id"
    }
    
    var title: String {
        groupTitle ?? "Untitled Group"
    }
}

// For creating groups
struct CreateGroupInfo: Codable {
    let groupId: UUID
    var groupTitle: String
    var description: String?
    var ownerId: UUID
    
    enum CodingKeys: String, CodingKey {
        case groupId = "group_id"
        case groupTitle = "group_title"
        case description
        case ownerId = "owner_id"
    }
}

// Group membership (groups table)
struct GroupMembership: Codable, Identifiable {
    var id: UUID { UUID() } // Computed since no real ID
    let groupId: UUID
    let userId: UUID
    var invite: Bool
    
    enum CodingKeys: String, CodingKey {
        case groupId = "group_id"
        case userId = "user_id"
        case invite
    }
}

// For fetching groups with info
struct GroupWithInfo: Codable, Identifiable {
    let groupId: UUID
    var invite: Bool?
    var groupInfo: GroupInfo?
    
    var id: UUID { groupId }
    
    enum CodingKeys: String, CodingKey {
        case groupId = "group_id"
        case invite
        case groupInfo = "group_info"
    }
}

// MARK: - Friend Models

struct FriendRequest: Codable, Identifiable {
    var id: UUID { UUID() }
    let id1: UUID
    let id2: UUID
    var createdAt: Date?
    
    enum CodingKeys: String, CodingKey {
        case id1 = "id_1"
        case id2 = "id_2"
        case createdAt = "created_at"
    }
}

struct FriendEntry: Codable, Identifiable {
    var id: UUID { UUID() }
    let id1: UUID
    let id2: UUID
    
    enum CodingKeys: String, CodingKey {
        case id1 = "id_1"
        case id2 = "id_2"
    }
}

struct BlockEntry: Codable {
    let userId1: UUID
    let userId2: UUID
    
    enum CodingKeys: String, CodingKey {
        case userId1 = "id_1"
        case userId2 = "id_2"
    }
}

// MARK: - Expense Models

struct ExpenseInfo: Codable, Identifiable {
    let id: UUID
    var title: String?
    var explanation: String?
    var totalAmount: Int? // In cents
    var payerId: UUID?
    var dueDate: Date?
    var date: Date?
    var proposal: Bool?
    var groupId: UUID?
    var receiptImage: String?
    var period: Int?
    
    enum CodingKeys: String, CodingKey {
        case id = "expense_id"
        case title, explanation
        case totalAmount = "total_amount"
        case payerId = "payer_id"
        case dueDate = "due_date"
        case date, proposal
        case groupId = "group_id"
        case receiptImage = "receipt_image"
        case period
    }
    
    var formattedAmount: String {
        let dollars = Double(totalAmount ?? 0) / 100.0
        return String(format: "$%.2f", dollars)
    }
}

struct ExpenseItem: Codable, Identifiable {
    let id: UUID
    let expenseId: UUID
    var name: String
    var price: Int // In cents
    var assignedToUserId: UUID?
    
    enum CodingKeys: String, CodingKey {
        case id
        case expenseId = "expense_id"
        case name
        case price
        case assignedToUserId = "assigned_to_user_id"
    }
}

enum RecurrenceFrequency: Int, CaseIterable, Identifiable, Codable {
    case none = 0
    case weekly = 7
    case biweekly = 14
    case monthly = 30
    case yearly = 365
    
    var id: Int { rawValue }
    
    var title: String {
        switch self {
        case .none: return "Does not repeat"
        case .weekly: return "Weekly"
        case .biweekly: return "Bi-weekly"
        case .monthly: return "Monthly"
        case .yearly: return "Yearly"
        }
    }
}

// For creating expenses
struct CreateExpenseInfo: Codable {
    let expenseId: UUID
    var title: String
    var explanation: String?
    var totalAmount: Int
    var payerId: UUID?
    var dueDate: Date?
    var proposal: Bool
    var groupId: UUID
    var period: Int?
    
    enum CodingKeys: String, CodingKey {
        case expenseId = "expense_id"
        case title, explanation
        case totalAmount = "total_amount"
        case payerId = "payer_id"
        case dueDate = "due_date"
        case proposal
        case groupId = "group_id"
        case period
    }
}

// Individual expense assignment (expense table)
struct Expense: Codable, Identifiable {
    var id: UUID { expenseId }
    let expenseId: UUID
    let userId: UUID
    var individualAmount: Int? // In cents
    var approval: Bool
    
    enum CodingKeys: String, CodingKey {
        case expenseId = "expense_id"
        case userId = "user_id"
        case individualAmount = "individual_amount"
        case approval
    }
    
    var formattedAmount: String {
        let dollars = Double(individualAmount ?? 0) / 100.0
        return String(format: "$%.2f", dollars)
    }
}

// For creating expense splits
struct CreateExpense: Codable {
    let expenseId: UUID
    let userId: UUID
    var individualAmount: Int
    var approval: Bool
    
    enum CodingKeys: String, CodingKey {
        case expenseId = "expense_id"
        case userId = "user_id"
        case individualAmount = "individual_amount"
        case approval
    }
}

// Expense with nested info for fetching
struct ExpenseWithInfo: Codable, Identifiable {
    var id: UUID { expenseId }
    let expenseId: UUID
    var individualAmount: Int?
    var approval: Bool?
    var expenseInfo: ExpenseInfo?
    
    enum CodingKeys: String, CodingKey {
        case expenseId = "expense_id"
        case individualAmount = "individual_amount"
        case approval
        case expenseInfo = "expense_info"
    }
}

// For expense split UI
struct ExpenseSplit: Identifiable {
    let id: UUID
    var userId: UUID
    var userInfo: UserInfo?
    var percentage: Double
    var amount: Double
    
    init(userId: UUID, userInfo: UserInfo? = nil, percentage: Double = 0, amount: Double = 0) {
        self.id = UUID()
        self.userId = userId
        self.userInfo = userInfo
        self.percentage = percentage
        self.amount = amount
    }
}

// MARK: - Legacy compatibility (keeping for existing code)

typealias Group = GroupInfo
struct GroupMember: Codable {
    var groupId: UUID
    var userId: UUID

    enum CodingKeys: String, CodingKey {
        case groupId = "group_id"
        case userId = "user_id"
    }
}

// MARK: - Notification Models

struct AppNotification: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    let type: NotificationType
    let title: String
    let message: String
    let relatedId: UUID?
    var isRead: Bool
    let createdAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case type
        case title
        case message
        case relatedId = "related_id"
        case isRead = "is_read"
        case createdAt = "created_at"
    }
}

enum NotificationType: String, Codable {
    case friendRequest = "friend_req"
    case groupInvite = "group_invite"
    case expenseProposal = "expense_proposal"
    case payingDues = "paying_dues"
    case requestAccepted = "request_accepted" // "Alice accepted your friend request"
}

// For inserting new notifications
struct CreateNotification: Codable {
    let userId: UUID
    let type: NotificationType
    let title: String
    let message: String
    let relatedId: UUID?
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case type
        case title
        case message
        case relatedId = "related_id"
    }
}
