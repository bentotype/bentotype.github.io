//
//  CustomTextFieldStyle.swift
//  Split
//
//  Created by Benjamin Chen on 12/23/25.
//

import SwiftUI

struct CustomTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color(uiColor: .tertiarySystemGroupedBackground))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.gray.opacity(0.3), lineWidth: 1)
            )
            .cornerRadius(10)
    }
}
