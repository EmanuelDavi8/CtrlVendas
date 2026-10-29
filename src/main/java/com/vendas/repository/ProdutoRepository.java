package com.vendas.repository;

import com.vendas.modelo.ProdutoModelo;
import com.vendas.modelo.UsuarioModelo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProdutoRepository extends JpaRepository<ProdutoModelo, Long> {
    List<ProdutoModelo> findByUsuario(UsuarioModelo usuario);

    List<ProdutoModelo> findByUsuario_Id(long usuarioId);

    List<ProdutoModelo> findByUsuario_IdOrUsuarioIsNull(long usuarioId);
}