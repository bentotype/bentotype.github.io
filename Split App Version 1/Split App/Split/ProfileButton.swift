//
//  ProfileButton.swift
//  Split
//
//  Created by Benjamin Chen on 12/26/25.
//

import SwiftUI
import Supabase
import Auth

struct ProfileButton: View {
    let action: () -> Void
    @State private var currentUser: UserInfo?
    
    var body: some View {
        Button(action: action) {
            if let user = currentUser {
                AvatarView(user: user, size: 36)
            } else {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(.secondary)
            }
        }
        .offset(y: 24)
        .task {
            // Load current user info for avatar
            if let userId = SupabaseManager.shared.auth.currentUser?.id {
                currentUser = try? await SupabaseService.shared.getUserInfo(userId: userId)
            }
        }
    }
}
