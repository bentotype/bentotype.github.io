//
//  AppleAuthUtils.swift
//  Split
//
//  Created by Benjamin Chen on 12/23/25.
//

import Foundation
import CryptoKit

struct AppleAuthUtils {
    /// Generates a random string to be used as the nonce.
    /// - Parameter length: Length of the random string (default 32).
    /// - Returns: A random string.
    static func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        var randomBytes = [UInt8](repeating: 0, count: length)
        let errorCode = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
        if errorCode != errSecSuccess {
            fatalError("Unable to generate nonce. SecRandomCopyBytes failed with OSStatus \(errorCode)")
        }

        let charset: [Character] =
            Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")

        let nonce = randomBytes.map { byte in
            // Pick a random character from the set, wrapping around if needed.
            charset[Int(byte) % charset.count]
        }

        return String(nonce)
    }

    /// Hashes the nonce string using SHA256, required by Apple's authentication request.
    /// - Parameter input: The random nonce string.
    /// - Returns: The SHA256 hash string.
    static func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        let hashString = hashedData.compactMap {
            String(format: "%02x", $0)
        }.joined()

        return hashString
    }
}
