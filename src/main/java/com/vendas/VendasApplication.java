package com.vendas;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootApplication
public class VendasApplication {

    public static void main(String[] args) {
        SpringApplication.run(VendasApplication.class, args);
    }

    @Bean
    public CommandLineRunner sanitizeDatabase(JdbcTemplate jdbcTemplate) {
        return args -> {
            try {
                jdbcTemplate.update("UPDATE usuarios SET admin_id = NULL WHERE admin_id = 0");
                jdbcTemplate.update("UPDATE produtos SET usuario_id = NULL WHERE usuario_id = 0");
                jdbcTemplate.update("UPDATE vendas SET usuario_id = NULL WHERE usuario_id = 0");
            } catch (Exception e) {
                // Silencioso se as tabelas ainda não existirem no primeiro boot
            }
        };
    }
}
