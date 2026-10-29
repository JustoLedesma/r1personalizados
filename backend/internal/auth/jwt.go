package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

type Claims struct {
	UserID   int    `json:"uid"`
	Username string `json:"sub"`
	FullName string `json:"name"`
	Role     string `json:"role"`
	Type     string `json:"typ"`
	Exp      int64  `json:"exp"`
}

func secretKey() []byte {
	sec := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if sec == "" {
		sec = "dev-default-secret-change-in-env"
	}
	return []byte(sec)
}

func GenerateToken(userID int, username, fullName, role, tokenType string, ttl time.Duration) (string, error) {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	claims := Claims{
		UserID:   userID,
		Username: username,
		FullName: fullName,
		Role:     role,
		Type:     tokenType,
		Exp:      time.Now().Add(ttl).Unix(),
	}
	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payload := base64.RawURLEncoding.EncodeToString(payloadBytes)
	signingInput := header + "." + payload
	sig := sign(signingInput, secretKey())
	return signingInput + "." + sig, nil
}

func ParseToken(tokenStr string, expectedType string) (*Claims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, errors.New("formato de token inválido")
	}
	signingInput := parts[0] + "." + parts[1]
	expectedSig := sign(signingInput, secretKey())
	if !hmac.Equal([]byte(parts[2]), []byte(expectedSig)) {
		return nil, errors.New("firma de token inválida")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("error decodificando payload: %w", err)
	}

	var claims Claims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fmt.Errorf("error leyendo claims: %w", err)
	}

	if time.Now().Unix() > claims.Exp {
		return nil, errors.New("token expirado")
	}
	if expectedType != "" && claims.Type != expectedType {
		return nil, errors.New("tipo de token inválido")
	}
	return &claims, nil
}

func sign(input string, key []byte) string {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(input))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

