//
//  PaymentsView.swift
//  Split
//
//  Settings view for managing payment app usernames
//

import SwiftUI

struct PaymentsView: View {
    @ObservedObject var viewModel: ProfileViewModel
    @State private var venmoUsername: String = ""
    @State private var paypalUsername: String = ""
    @State private var cashAppUsername: String = ""
    @State private var isSaving = false
    @State private var showingSaveConfirmation = false
    
    var body: some View {
        List {
            Section {
                Text("Link your payment accounts so friends can easily pay you. These usernames will be visible to your friends.")
                    .font(.footnote)
                    .foregroundColor(.secondary)
            }
            .listRowBackground(Color.clear)
            
            // Venmo
            Section {
                HStack(spacing: 12) {
                    Image(systemName: "v.circle.fill")
                        .font(.title2)
                        .foregroundColor(.blue)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Venmo")
                            .font(.headline)
                        TextField("@username", text: $venmoUsername)
                            .textContentType(.username)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                    }
                }
            } footer: {
                Text("Enter your Venmo username without the @ symbol")
                    .font(.caption)
            }
            
            // PayPal
            Section {
                HStack(spacing: 12) {
                    Image(systemName: "p.circle.fill")
                        .font(.title2)
                        .foregroundColor(.indigo)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("PayPal")
                            .font(.headline)
                        TextField("paypal.me/username", text: $paypalUsername)
                            .textContentType(.username)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                    }
                }
            } footer: {
                Text("Enter your PayPal.me username")
                    .font(.caption)
            }
            
            // Cash App
            Section {
                HStack(spacing: 12) {
                    Image(systemName: "dollarsign.circle.fill")
                        .font(.title2)
                        .foregroundColor(.green)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Cash App")
                            .font(.headline)
                        TextField("$cashtag", text: $cashAppUsername)
                            .textContentType(.username)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                    }
                }
            } footer: {
                Text("Enter your Cash App $cashtag without the $ symbol")
                    .font(.caption)
            }
            
            // Save Button
            Section {
                Button(action: savePaymentInfo) {
                    HStack {
                        Spacer()
                        if isSaving {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Save Payment Info")
                                .fontWeight(.semibold)
                        }
                        Spacer()
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Color.indigo)
                .foregroundColor(.white)
                .disabled(isSaving)
            }
            
            // Info Section
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Why can't I auto-connect?", systemImage: "info.circle")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    
                    Text("Venmo, PayPal, and Cash App don't provide APIs for third-party apps to access your account information. You'll need to enter your usernames manually.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .navigationTitle("Payments")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // Load existing payment info
            venmoUsername = viewModel.userInfo?.venmoUsername ?? ""
            paypalUsername = viewModel.userInfo?.paypalUsername ?? ""
            cashAppUsername = viewModel.userInfo?.cashAppUsername ?? ""
        }
        .alert("Saved!", isPresented: $showingSaveConfirmation) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("Your payment information has been updated.")
        }
    }
    
    private func savePaymentInfo() {
        isSaving = true
        
        Task {
            await viewModel.updatePaymentInfo(
                venmo: venmoUsername.isEmpty ? nil : venmoUsername.replacingOccurrences(of: "@", with: ""),
                paypal: paypalUsername.isEmpty ? nil : paypalUsername,
                cashApp: cashAppUsername.isEmpty ? nil : cashAppUsername.replacingOccurrences(of: "$", with: "")
            )
            
            await MainActor.run {
                isSaving = false
                showingSaveConfirmation = true
            }
        }
    }
}

#Preview {
    NavigationStack {
        PaymentsView(viewModel: ProfileViewModel())
    }
}
