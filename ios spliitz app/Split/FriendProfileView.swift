import SwiftUI
import Auth
import Supabase

struct FriendProfileView: View {
    let friend: UserInfo
    @State private var dues: [SupabaseService.Due] = []
    @State private var isLoading = false
    @State private var netBalance: Double = 0 // + Friend owes me, - I owe friend
    @State private var selectedExpense: ExpenseInfo?
    @State private var showPaymentSheet = false
    @State private var showConfirmPaymentAlert = false
    @State private var showOwedAlert = false
    
    // Cache for group names
    @State private var groupNames: [UUID: String] = [:]
    
    // Get current user ID
    private var currentUserId: UUID? {
        SupabaseManager.shared.auth.currentSession?.user.id
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header: Avatar & Name
                VStack(spacing: 12) {
                    AvatarView(user: friend, size: 100)
                    
                    VStack(spacing: 4) {
                        Text(friend.fullName)
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        if let username = friend.username {
                            Text("@\(username)")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding(.top)
                
                // Net Balance Card
                VStack(spacing: 8) {
                    Text("Net Balance")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    if isLoading {
                        ProgressView()
                    } else if netBalance == 0 {
                        Text("Settled Up")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(.secondary)
                            .padding(.vertical, 8)
                        
                        Text("No outstanding balance")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            
                    } else {
                        // Logic: 
                        // If netBalance > 0: Friend owes me (Green)
                        // If netBalance < 0: I owe friend (Red)
                        
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text(netBalance > 0 ? "+" : "-")
                            Text(String(format: "$%.2f", abs(netBalance)))
                        }
                        .font(.system(size: 36, weight: .bold))
                        .foregroundColor(netBalance > 0 ? .green : .red)
                        
                        Text(netBalance > 0 ? "\(friend.firstName ?? friend.fullName) owes you" : "You owe \(friend.firstName ?? friend.fullName)")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(netBalance > 0 ? .green : .red)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                (netBalance > 0 ? Color.green : Color.red)
                                    .opacity(0.1)
                            )
                            .cornerRadius(12)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(20)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .cornerRadius(16)
                .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
                .padding(.horizontal)
                
                // Transactions List
                VStack(alignment: .leading, spacing: 16) {
                    Text("History")
                        .font(.headline)
                        .padding(.horizontal)
                    
                    if dues.isEmpty && !isLoading {
                        Text("No transaction history")
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding()
                    } else {
                        LazyVStack(spacing: 12) {
                            ForEach(dues) { due in
                                TransactionRow(
                                    due: due, 
                                    currentUserId: currentUserId, 
                                    friendName: friend.firstName ?? friend.fullName,
                                    groupName: due.expenseInfo?.groupId.flatMap { groupNames[$0] },
                                    onConfirm: {
                                        Task {
                                            await confirmReceipt(due: due)
                                        }
                                    }
                                )
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    if let expense = due.expenseInfo {
                                        selectedExpense = expense
                                    }
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.bottom)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button {
                        if netBalance > 0 {
                            showOwedAlert = true
                        } else {
                            showPaymentSheet = true
                        }
                    } label: {
                        Label("Settle Dues", systemImage: "dollarsign.circle")
                    }
                    
                    Button(role: .destructive) {
                        Task {
                            try? await SupabaseService.shared.removeFriend(userId: currentUserId ?? UUID(), friendId: friend.id)
                        }
                    } label: {
                        Label("Remove Friend", systemImage: "person.fill.xmark")
                    }
                    
                    Button(role: .destructive) {
                        Task {
                            try? await SupabaseService.shared.blockFriend(userId: currentUserId ?? UUID(), friendId: friend.id)
                        }
                    } label: {
                        Label("Block Friend", systemImage: "hand.raised.fill")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 14, weight: .bold)) // Three dots standard size
                        .padding(8)
                        .background(Color(uiColor: .secondarySystemBackground))
                        .clipShape(Circle())
                }
            }
        }
        .task {
            await fetchDues()
        }
        .sheet(item: $selectedExpense) { expense in
            ExpenseDetailSheet(expense: expense)
        }
        .sheet(isPresented: $showPaymentSheet) {
            SettleDuesSheet(friend: friend) {
                // On dismiss/return from app
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    showConfirmPaymentAlert = true
                }
            }
            .presentationDetents([.height(300)])
        }
        .alert("Did you pay?", isPresented: $showConfirmPaymentAlert) {
            Button("Full") {
                Task {
                    await markAsPaid()
                }
            }
            Button("No", role: .cancel) { }
        } message: {
            Text("If you completed the payment, mark it as paid so \(friend.firstName ?? "your friend") can confirm.")
        }
        .alert("They owe you money", isPresented: $showOwedAlert) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("\(friend.firstName ?? friend.fullName) owes you money.")
        }
    }
    
    private func fetchDues() async {
        guard let myId = currentUserId else { return }
        isLoading = true
        
        do {
            // Fetch dues
            let fetchedDues = try await SupabaseService.shared.fetchDues(user1: myId, user2: friend.id)
            self.dues = fetchedDues
            calculateNetBalance(myId: myId)
            
            // Fetch groups to map names
            await fetchGroups(userId: myId)
        } catch {
            print("Error fetching dues: \(error)")
        }
        
        isLoading = false
    }
    
    private func fetchGroups(userId: UUID) async {
        do {
            let groups = try await SupabaseService.shared.getUserGroups(userId: userId)
            var names: [UUID: String] = [:]
            for group in groups {
                if let info = group.groupInfo {
                    names[group.groupId] = info.title
                }
            }
            self.groupNames = names
        } catch {
            print("Error fetching groups: \(error)")
        }
    }
    
    private func calculateNetBalance(myId: UUID) {
        var total: Double = 0
        
        for due in dues {
            // If received is true, it's fully settled, don't count it.
            if due.received { continue }
            
            // If paid is true but received is false, it DOES count towards total owed (based on user prompt interpretation)
            // "If the recipient confirms it the received will be true too and this expense would be greyed out and not count towards total owed."
            // Implication: Before received is true, it DOES count.
            
            if due.id1 == myId { // I paid, they owe me
                total += Double(due.amount) / 100.0
            } else if due.id2 == myId { // I owe them
                total -= Double(due.amount) / 100.0
            }
        }
        
        self.netBalance = total
    }
    
    private func markAsPaid() async {
        guard let myId = currentUserId else { return }
        do {
            try await SupabaseService.shared.markDuesAsPaid(userId: myId, friendId: friend.id)
            await fetchDues() // Refresh to show "Paid" status
        } catch {
            print("Error marking as paid: \(error)")
        }
    }
    
    private func confirmReceipt(due: SupabaseService.Due) async {
        guard let myId = currentUserId else { return }
        // Verify I am the one owed (id1)
        guard due.id1 == myId else { return }
        
        do {
            try await SupabaseService.shared.confirmDueReceipt(expenseId: due.expenseId, owerId: due.id2)
            await fetchDues()
        } catch {
            print("Error confirming receipt: \(error)")
        }
    }
}

struct TransactionRow: View {
    let due: SupabaseService.Due
    let currentUserId: UUID?
    let friendName: String
    var groupName: String?
    var onConfirm: () -> Void
    
    var isIOwe: Bool {
        due.id2 == currentUserId
    }
    
    // Amount is now Int (cents)
    var formattedAmount: String {
        let val = Double(due.amount) / 100.0
        return String(format: "$%.2f", val)
    }
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(due.expenseInfo?.title ?? "Expense")
                    .font(.body)
                    .fontWeight(.medium)
                    .foregroundColor(due.received ? .gray : .primary)
                    // Removed strikethrough per user request
                
                if let name = groupName {
                    Text(name)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                if due.received {
                    Text("Settled")
                        .font(.caption)
                        .foregroundColor(.gray)
                } else if due.paid {
                    Text(isIOwe ? "Payment Sent" : "Payment Received - Confirm?")
                        .font(.caption)
                        .foregroundColor(isIOwe ? .blue : .orange)
                        .fontWeight(.medium)
                } else {
                    Text(isIOwe ? "You owe \(friendName)" : "\(friendName) owes you")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            VStack(alignment: .trailing) {
                Text(formattedAmount)
                    .fontWeight(.bold)
                    // Use gray for received, otherwise regular logic
                    .foregroundColor(due.received ? .gray : (isIOwe ? .red : .green))
                    // Removed strikethrough per user request
                
                if !isIOwe && due.paid && !due.received {
                    Button("Confirm") {
                        onConfirm()
                    }
                    .font(.caption)
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .cornerRadius(12)
        .opacity(due.received ? 0.6 : 1.0)
    }
}

struct SettleDuesSheet: View {
    let friend: UserInfo
    var onDismiss: () -> Void
    @Environment(\.dismiss) var dismiss
    @State private var alertMessage: String?
    @State private var showingAlert = false
    
    var hasAnyMethod: Bool {
        hasPhone || hasPaypal || hasVenmo || hasCashApp
    }
    
    var hasPhone: Bool {
        friend.phoneNumber?.isEmpty == false
    }
    
    var hasPaypal: Bool {
        friend.paypalUsername?.isEmpty == false
    }
    
    var hasVenmo: Bool {
        friend.venmoUsername?.isEmpty == false
    }
    
    var hasCashApp: Bool {
        friend.cashAppUsername?.isEmpty == false
    }
    
    var body: some View {
        NavigationView {
            List {
                if !hasAnyMethod {
                    Section {
                        Text("The recipient hasn't filled out payment information.")
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding()
                    }
                } else {
                    Section(header: Text("Choose Payment Method")) {
                        if hasPhone {
                            PaymentOptionRow(icon: "message.fill", color: .green, name: "Messages / Apple Cash") {
                                openMessages()
                            }
                        }
                        
                        if hasPaypal {
                            PaymentOptionRow(icon: "p.circle.fill", color: .blue, name: "PayPal") {
                                handlePayment(type: .paypal)
                            }
                        }
                        
                        if hasVenmo {
                            PaymentOptionRow(icon: "v.circle.fill", color: .blue, name: "Venmo") {
                                handlePayment(type: .venmo)
                            }
                        }
                        
                        if hasCashApp {
                            PaymentOptionRow(icon: "dollarsign.circle.fill", color: .green, name: "Cash App") {
                                handlePayment(type: .cashapp)
                            }
                        }
                    }
                }
                
                Section {
                    Button("Testing: Simulate Payment") {
                        closeAndTrigger()
                    }
                    .foregroundColor(.orange)
                }
            }
            .navigationTitle("Settle Dues")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .alert("Missing Information", isPresented: $showingAlert, actions: {
                Button("OK", role: .cancel) { }
            }, message: {
                Text(alertMessage ?? "Details missing.")
            })
        }
    }

    enum PaymentType {
        case paypal, venmo, cashapp
    }

    func handlePayment(type: PaymentType) {
        var username: String?
        var urlString: String?

        switch type {
        case .paypal:
            username = friend.paypalUsername
            if let user = username {
                urlString = "paypal://paypal.me/\(user)"
            }
        case .venmo:
            username = friend.venmoUsername
            if let user = username {
                urlString = "venmo://paycharge?txn=pay&recipients=\(user)"
            }
        case .cashapp:
            username = friend.cashAppUsername
            if let user = username {
                 urlString = "cashme://\(user)"
            }
        }

        if username == nil || username?.isEmpty == true {
            alertMessage = "\(friend.firstName ?? "Friend") has not filled out payment information for this service."
            showingAlert = true
            return
        }
        
        if let urlStr = urlString, let url = URL(string: urlStr) {
             openURL(url, fallback: getWebURL(type: type, username: username!))
        }
    }
    
    func getWebURL(type: PaymentType, username: String) -> URL? {
         switch type {
         case .paypal: return URL(string: "https://www.paypal.com/paypalme/\(username)")
         case .venmo: return URL(string: "https://venmo.com/\(username)")
         case .cashapp: return URL(string: "https://cash.app/$\(username)")
         }
    }
    
    func openMessages() {
        if let phone = friend.phoneNumber, !phone.isEmpty {
            let cleanPhone = phone.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
            if let url = URL(string: "sms:/\(cleanPhone)") {
                UIApplication.shared.open(url)
                closeAndTrigger()
            }
        } else {
             alertMessage = "\(friend.firstName ?? "Friend") has not filled out payment information (phone number)."
             showingAlert = true
        }
    }

    func openURL(_ url: URL, fallback: URL?) {
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
            closeAndTrigger()
        } else if let fallback = fallback {
            UIApplication.shared.open(fallback)
            closeAndTrigger()
        } else {
            alertMessage = "Could not open payment app."
            showingAlert = true
        }
    }
    
    func closeAndTrigger() {
        dismiss()
        onDismiss()
    }
}

struct PaymentOptionRow: View {
    let icon: String
    let color: Color
    let name: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                    .frame(width: 30)
                
                Text(name)
                    .foregroundColor(.primary)
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            .padding(.vertical, 4)
        }
    }
}
