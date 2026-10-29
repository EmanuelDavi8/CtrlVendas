package com.vendas.repository;

import com.vendas.modelo.UsuarioModelo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<UsuarioModelo, Long> {
    Optional<UsuarioModelo> findByCpf(String cpf);
    Optional<UsuarioModelo> findByCnpj(String cnpj);
    boolean existsByCpf(String cpf);
    boolean existsByCnpj(String cnpj);
    List<UsuarioModelo> findByAdministradorIdAndStatus(Long adminId, String string);
}
