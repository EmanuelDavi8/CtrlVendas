package com.vendas.controller;

import com.vendas.modelo.UsuarioModelo;
import com.vendas.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    private final UsuarioRepository usuarioRepository;

    public UsuarioController(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @GetMapping
    public List<UsuarioModelo> listarTodos() {
        return usuarioRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<UsuarioModelo> buscarPorId(@PathVariable Long id) {
        return usuarioRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Listar vendedores pendentes vinculados a um Admin específico
    @GetMapping("/pendentes/admin/{adminId}")
    public ResponseEntity<List<UsuarioModelo>> listarPendentesPorAdmin(@PathVariable Long adminId) {
        List<UsuarioModelo> pendentes = usuarioRepository.findByAdministradorIdAndStatus(adminId, "PENDENTE");
        return ResponseEntity.ok(pendentes);
    }

    // Endpoint para o Admin aprovar o Vendedor
    @PutMapping("/{id}/aprovar")
    public ResponseEntity<?> aprovarVendedor(@PathVariable Long id) {
        Optional<UsuarioModelo> usuarioOpt = usuarioRepository.findById(id);
        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Usuário não encontrado!"));
        }
        UsuarioModelo vendedor = usuarioOpt.get();
        vendedor.setStatus("APROVADO");
        usuarioRepository.save(vendedor);
        return ResponseEntity.ok(Map.of("message", "Vendedor aprovado com sucesso!"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> fazerLogin(@RequestBody UsuarioModelo credenciais) {
        Optional<UsuarioModelo> usuarioOpt = usuarioRepository.findByCpf(credenciais.getCpf());

        if (usuarioOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "CPF não encontrado!"));
        }

        UsuarioModelo usuario = usuarioOpt.get();

        if (usuario.getSenha() == null || !usuario.getSenha().equals(credenciais.getSenha())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Senha incorreta!"));
        }

        // Validação: se for vendedor e estiver pendente, bloqueia o login
        if ("VENDEDOR".equals(usuario.getTipo()) && "PENDENTE".equals(usuario.getStatus())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Sua conta aguarda aprovação do Administrador!"));
        }

        return ResponseEntity.ok(usuario);
    }

    @PostMapping
    public ResponseEntity<?> salvar(@RequestBody UsuarioModelo usuario) {
        try {
            // Só verifica se o CPF existe se ele foi enviado
            boolean cpfExists = usuario.getCpf() != null && !usuario.getCpf().isEmpty()
                    && usuarioRepository.existsByCpf(usuario.getCpf());

            // Só verifica o CNPJ se ele não estiver vazio ou nulo (essencial para
            // vendedores)
            boolean cnpjExists = usuario.getCnpj() != null && !usuario.getCnpj().trim().isEmpty()
                    && usuarioRepository.existsByCnpj(usuario.getCnpj());

            // Se for vendedor, define o status como PENDENTE e localiza o Admin pelo ID
            if ("VENDEDOR".equals(usuario.getTipo())) {
                usuario.setStatus("PENDENTE");
                usuario.setCnpj(null); // Garante que vendedor nunca guarda CNPJ em branco/vazio

                if (usuario.getAdministrador() != null && usuario.getAdministrador().getId() != null) {
                    Optional<UsuarioModelo> adminOpt = usuarioRepository.findById(usuario.getAdministrador().getId());
                    adminOpt.ifPresent(usuario::setAdministrador);
                }
            } else {
                usuario.setStatus("APROVADO");
                usuario.setAdministrador(null);
            }

            if (cpfExists || cnpjExists) {
                UsuarioModelo existing = cpfExists
                        ? usuarioRepository.findByCpf(usuario.getCpf()).orElse(null)
                        : usuarioRepository.findByCnpj(usuario.getCnpj()).orElse(null);

                if (existing != null) {
                    existing.setNomeCompleto(usuario.getNomeCompleto());
                    existing.setSenha(usuario.getSenha());
                    existing.setNomeEmpresa(usuario.getNomeEmpresa());
                    existing.setStatus(usuario.getStatus());
                    existing.setAdministrador(usuario.getAdministrador());
                    if (!cpfExists && usuario.getCpf() != null)
                        existing.setCpf(usuario.getCpf());
                    if (!cnpjExists && usuario.getCnpj() != null)
                        existing.setCnpj(usuario.getCnpj());

                    UsuarioModelo updated = usuarioRepository.save(existing);
                    return ResponseEntity.ok(updated);
                }
            }

            UsuarioModelo novoUsuario = usuarioRepository.save(usuario);
            return ResponseEntity.status(HttpStatus.CREATED).body(novoUsuario);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Erro ao registrar usuário: " + e.getMessage()));
        }
    }
}