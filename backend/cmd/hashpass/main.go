package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	fmt.Println("==================================================")
	fmt.Println("  NETZ - Generador de Hash Bcrypt para Contraseñas")
	fmt.Println("==================================================")
	fmt.Println()

	var password string
	if len(os.Args) > 1 {
		password = strings.TrimSpace(os.Args[1])
	} else {
		fmt.Print("Ingrese la contraseña a hashear: ")
		scanner := bufio.NewScanner(os.Stdin)
		if scanner.Scan() {
			password = strings.TrimSpace(scanner.Text())
		}
	}

	if password == "" {
		fmt.Fprintln(os.Stderr, "Error: La contraseña no puede estar vacía.")
		os.Exit(1)
	}

	// Costo 12 para alta seguridad
	hashBytes, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error al generar hash: %v\n", err)
		os.Exit(1)
	}

	hashStr := string(hashBytes)
	fmt.Println("\nHash generado exitosamente:")
	fmt.Println(hashStr)
	fmt.Println("\nPuede copiar este valor en backend/.env como:")
	fmt.Println("ROOT_PASSWORD_HASH='" + hashStr + "'")
	fmt.Println("==================================================")
}

