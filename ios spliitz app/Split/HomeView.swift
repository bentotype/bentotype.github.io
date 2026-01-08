//
//  HomeView.swift
//  Split
//
//  Dashboard view with monthly total and pending proposals
//

import Foundation
import SwiftUI
import Supabase

struct HomeView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = HomeViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Custom Header
                    Text("Split")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 16)
                    // Summary Card
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Total spent in \(viewModel.currentMonthName)")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        Text(viewModel.formattedMonthlyTotal)
                            .font(.system(size: 42, weight: .bold))
                            .foregroundColor(.primary)
                        
                        Text("Across all your groups")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .cornerRadius(16)
                    .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
                    
                    // Calendar
                    CalendarView(viewModel: viewModel)
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
            .appBackground()
            .toolbar(.hidden, for: .navigationBar)
            .refreshable {
                await viewModel.fetchAll()
            }
            .onAppear {
                // Always fetch to ensure data is fresh
                Task.detached(priority: .userInitiated) {
                    await viewModel.fetchAll()
                }
            }
        }
    }
}

// MARK: - Proposal Row

struct ProposalRow: View {
    let proposal: ExpenseWithInfo
    
    var body: some View {
        HStack(spacing: 12) {
            // Date Box
            if let date = proposal.expenseInfo?.dueDate {
                VStack(spacing: 0) {
                    Text(date.formatted(.dateTime.month()))
                        .font(.system(size: 10, weight: .bold))
                        .textCase(.uppercase)
                        .foregroundColor(.red)
                    
                    Text(date.formatted(.dateTime.day()))
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.primary)
                }
                .frame(width: 40, height: 40)
                .background(Color(uiColor: .systemGroupedBackground))
                .cornerRadius(8)
            } else {
                Image(systemName: "calendar")
                    .font(.system(size: 20))
                    .foregroundColor(.secondary)
                    .frame(width: 40, height: 40)
                    .background(Color(uiColor: .systemGroupedBackground))
                    .cornerRadius(8)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(proposal.expenseInfo?.title ?? "Expense")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                Text("Group")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(proposal.expenseInfo?.formattedAmount ?? "$0.00")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.indigo)
                
                if let total = proposal.expenseInfo?.totalAmount {
                    Text("of \(String(format: "$%.2f", Double(total) / 100.0))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .background(Color(uiColor: .tertiarySystemGroupedBackground))
        .cornerRadius(12)
    }
}

#Preview {
    HomeView()
        .environmentObject(AuthViewModel())
}

