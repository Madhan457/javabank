package com.example.bankmanagement.controller;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private static final BCryptPasswordEncoder PASSWORD_ENCODER = new BCryptPasswordEncoder();

	private final JdbcTemplate jdbcTemplate;

	public AuthController(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	@PostMapping("/officer/login")
	public ResponseEntity<Map<String, Object>> officerLogin(@RequestBody(required = false) LoginRequest request) {
		if (request == null || request.usernameOrEmail() == null || request.password() == null
				|| request.usernameOrEmail().isBlank() || request.password().isEmpty()) {
			return ResponseEntity.badRequest().body(Map.of(
					"success", false,
					"message", "Username and password are required."));
		}

		String username = request.usernameOrEmail().trim();
		String storedPassword;
		try {
			storedPassword = jdbcTemplate.queryForObject(
					"SELECT password_hash FROM officer WHERE username = ? LIMIT 1",
					String.class,
					username);
		} catch (EmptyResultDataAccessException exception) {
			storedPassword = null;
		}

		if (storedPassword == null || !passwordMatches(request.password(), storedPassword)) {
			return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
					"success", false,
					"message", "Invalid username or password."));
		}

		return ResponseEntity.ok(Map.of(
				"success", true,
				"message", "Officer login successful.",
				"officer", Map.of("username", username, "role", "OFFICER")));
	}

	private boolean passwordMatches(String rawPassword, String storedPassword) {
		if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$")
				|| storedPassword.startsWith("$2y$")) {
			return PASSWORD_ENCODER.matches(rawPassword, storedPassword);
		}

		return MessageDigest.isEqual(
				rawPassword.getBytes(StandardCharsets.UTF_8),
				storedPassword.getBytes(StandardCharsets.UTF_8));
	}

	public record LoginRequest(String usernameOrEmail, String password) {
	}
}
