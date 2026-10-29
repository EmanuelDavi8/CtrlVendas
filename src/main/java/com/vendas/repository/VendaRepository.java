package com.vendas.repository;

import com.vendas.modelo.VendaModelo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface VendaRepository extends JpaRepository<VendaModelo, String> {
    List<VendaModelo> findByUsuarioIdOrderByDataHoraDesc(Long usuarioId);
}
