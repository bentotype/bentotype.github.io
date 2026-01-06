//
//  CreateExpenseView.swift
//  Split
//
//  Create expense modal with split functionality
//

import SwiftUI

struct CreateExpenseView: View {
    @StateObject private var viewModel: CreateExpenseViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDueDateSheet = false
    let onComplete: () -> Void
    
    let groupId: UUID
    let members: [UserInfo]
    
    // Prefilled data from scanner
    var prefilledAmount: Double? = nil
    var prefilledExplanation: String? = nil
    var prefilledSplits: [UUID: Double]? = nil
    
    init(groupId: UUID, members: [UserInfo], prefilledAmount: Double? = nil, prefilledExplanation: String? = nil, prefilledSplits: [UUID: Double]? = nil, onComplete: @escaping () -> Void) {
        self.groupId = groupId
        self.members = members
        self.prefilledAmount = prefilledAmount
        self.prefilledExplanation = prefilledExplanation
        self.prefilledSplits = prefilledSplits
        _viewModel = StateObject(wrappedValue: CreateExpenseViewModel(groupId: groupId, members: members, prefilledSplits: prefilledSplits))
        self.onComplete = onComplete
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    VStack(alignment: .leading, spacing: 4) {
                        EmptyView()
                    }
                    // .frame(maxWidth: .infinity, alignment: .leading) // Removed frame as content is empty
                    
                    // Form
                    VStack(spacing: 16) {
                        // Title & Amount
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Title")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                TextField("Groceries, utilities...", text: $viewModel.title)
                                    .textFieldStyle(CustomTextFieldStyle())
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Total amount (USD)")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                TextField("0.00", text: $viewModel.totalAmount)
                                    .textFieldStyle(CustomTextFieldStyle())
                                    .onChange(of: viewModel.totalAmount) { oldValue, newValue in
                                        viewModel.recalculateAmounts()
                                    }
                            }
                        }
                        
                        // Payer & Due Date
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Payer (optional)")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                
                                Picker("Payer", selection: $viewModel.payerId) {
                                    Text("").tag(nil as UUID?)
                                    ForEach(viewModel.members) { member in
                                        Text(member.fullName).tag(member.id as UUID?)
                                    }
                                }
                                .pickerStyle(.menu)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(Color(uiColor: .tertiarySystemGroupedBackground))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                                )
                                .cornerRadius(10)
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Due date")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                
                                Button(action: {
                                    showDueDateSheet = true
                                }) {
                                    HStack {
                                        if viewModel.hasDueDate {
                                            VStack(alignment: .leading) {
                                                Text(viewModel.dueDate.formatted(date: .abbreviated, time: .omitted))
                                                    .foregroundColor(.primary)
                                                if viewModel.recurrence != .none {
                                                    Text(viewModel.recurrence.title)
                                                        .font(.caption2)
                                                        .foregroundColor(.indigo)
                                                }
                                            }
                                        } else {
                                            Text("No due date")
                                                .foregroundColor(.secondary)
                                        }
                                        
                                        Spacer()
                                        
                                        Image(systemName: "calendar")
                                            .foregroundColor(.indigo)
                                    }
                                    .padding(.vertical, 10)
                                    .padding(.horizontal, 12)
                                    .background(Color(uiColor: .tertiarySystemGroupedBackground))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                                    )
                                    .cornerRadius(10)
                                }
                            }
                        }
                        
                        // Explanation
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Explanation")
                                .font(.caption)
                                .fontWeight(.semibold)
                            
                            TextField("Add context so everyone knows what this is", text: $viewModel.explanation, axis: .vertical)
                                .lineLimit(3...5)
                                .textFieldStyle(CustomTextFieldStyle())
                        }
                    }
                    
                    // Split Section
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Split between members")
                                    .font(.subheadline)
                                    .fontWeight(.bold)
                                
                                Text("Adjust sliders to set each person's share")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                            
                            Button("Split evenly") {
                                viewModel.splitEvenly()
                            }
                            .font(.caption)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.indigo.opacity(0.15))
                            .foregroundColor(.indigo)
                            .cornerRadius(16)
                        }
                        
                        // Member splits
                        ForEach($viewModel.splits) { $split in
                            SplitMemberRow(split: $split, totalAmount: Double(viewModel.totalAmount) ?? 0)
                        }
                        
                        // Total
                        Divider()
                        
                        HStack {
                            Text("Total from splits")
                                .fontWeight(.bold)
                            
                            Spacer()
                            
                            Text(viewModel.formattedTotalFromSplits)
                                .fontWeight(.bold)
                        }
                        
                        Text(viewModel.splitStatus)
                            .font(.caption)
                            .foregroundColor(viewModel.splitMatchesTotal ? .green : .orange)
                    }
                    .padding()
                    .background(Color.gray.opacity(0.05))
                    .cornerRadius(16)
                    
                    // Error
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                    
                    // Actions
                    HStack(spacing: 12) {
                        Button("Cancel") {
                            dismiss()
                        }
                        .fontWeight(.semibold)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(Color.gray.opacity(0.2))
                        .foregroundColor(.primary)
                        .cornerRadius(12)
                        
                        Button(action: {
                            Task {
                                let success = await viewModel.createExpense()
                                if success {
                                    onComplete()
                                    dismiss()
                                }
                            }
                        }) {
                            ZStack {
                                if viewModel.isLoading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Save expense")
                                        .fontWeight(.bold)
                                }
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .frame(maxWidth: .infinity)
                            .background(
                                LinearGradient(colors: [.indigo, .purple], startPoint: .leading, endPoint: .trailing)
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .contentShape(Rectangle()) // Ensure entire area is hittable
                        }
                        .disabled(viewModel.isLoading)
                    }
                }
                .padding()
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("New Expense")
            .navigationTitle("Add Expense")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            }
        .sheet(isPresented: $showDueDateSheet) {
            NavigationStack {
                Form {
                    Section {
                        Toggle("Enable Due Date", isOn: $viewModel.hasDueDate)
                            .tint(.indigo)
                    }
                    
                    if viewModel.hasDueDate {
                        Section("Date") {
                            DatePicker("Due Date", selection: $viewModel.dueDate, displayedComponents: .date)
                                .datePickerStyle(.graphical)
                                .tint(.indigo)
                        }
                        
                        Section("Recurrence") {
                            Picker("Repeats", selection: $viewModel.recurrence) {
                                ForEach(RecurrenceFrequency.allCases) { frequency in
                                    Text(frequency.title).tag(frequency)
                                }
                            }
                            .pickerStyle(.menu)
                        }
                    }
                }
                .navigationTitle("Due Date Settings")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") {
                            showDueDateSheet = false
                        }
                    }
                }
            }
            .presentationDetents([.medium, .large])
        }
    }
}

// MARK: - Split Member Row

struct SplitMemberRow: View {
    @Binding var split: ExpenseSplit
    let totalAmount: Double
    
    var body: some View {
        HStack(spacing: 12) {
            Text(split.userInfo?.fullName ?? "Member")
                .fontWeight(.semibold)
                .lineLimit(1)
            
            Spacer()
            
            // Percentage Input
            HStack(spacing: 2) {
                TextField("0", value: Binding(
                    get: { split.percentage },
                    set: { newValue in
                        // Update percentage
                        split.percentage = min(100, max(0, newValue))
                        // Update amount
                        if totalAmount > 0 {
                            split.amount = (split.percentage / 100.0) * totalAmount
                        }
                    }
                ), format: .number.precision(.fractionLength(0...1)))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.indigo)
                .frame(width: 40)
                
                Text("%")
                    .font(.caption)
                    .foregroundColor(.indigo)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(Color.indigo.opacity(0.1))
            .cornerRadius(8)
            
            // Amount Input
            TextField("0.00", value: Binding(
                get: { split.amount },
                set: { newValue in
                    // Clamp amount
                    let clampedAmount = min(max(newValue, 0), totalAmount)
                    split.amount = clampedAmount
                    
                    // Update percentage
                    if totalAmount > 0 {
                        split.percentage = (clampedAmount / totalAmount) * 100
                    } else {
                        split.percentage = 0
                    }
                }
            ), format: .number.precision(.fractionLength(2)))
            .keyboardType(.decimalPad)
            .multilineTextAlignment(.trailing)
            .fontWeight(.bold)
            .monospacedDigit()
            .frame(width: 80)
            .textFieldStyle(.roundedBorder)
        }
        .padding(.vertical, 8)
    }
}

#Preview {
    CreateExpenseView(
        groupId: UUID(),
        members: [
            UserInfo(id: UUID(), username: "john", email: "john@example.com", firstName: "John", lastName: "Doe"),
            UserInfo(id: UUID(), username: "jane", email: "jane@example.com", firstName: "Jane", lastName: "Smith")
        ],
        onComplete: {}
    )
}
