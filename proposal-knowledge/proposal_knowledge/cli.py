from __future__ import annotations

import argparse
import sys
from pathlib import Path

import uvicorn

from proposal_knowledge.application.auth_service import (
    SCOPE_MCP_CATALOG,
    SCOPE_MCP_CV,
    create_api_key_record,
    list_api_keys,
    revoke_api_key,
)
from proposal_knowledge.application.import_catalog import (
    import_catalog_pair,
    import_packages_file,
    import_products_file,
)
from proposal_knowledge.application.import_cv import import_people_json
from proposal_knowledge.config import get_settings, resolve_avatar_public_base_url
from proposal_knowledge.infrastructure.db.session import init_db, session_scope


def _resolve_import_path(args: argparse.Namespace) -> Path:
    path = getattr(args, "file", None) or getattr(args, "xlsx", None) or getattr(
        args, "json", None
    )
    if path is None:
        raise SystemExit("Missing --file (or --xlsx / --json)")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(prog="proposal-knowledge")
    sub = parser.add_subparsers(dest="command", required=True)

    serve_p = sub.add_parser("serve", help="Run HTTP server")
    serve_p.add_argument("--host", default="127.0.0.1")
    serve_p.add_argument("--port", type=int, default=8093)

    db = sub.add_parser("db", help="Database schema (SQLAlchemy create_all)")
    db_sub = db.add_subparsers(dest="db_cmd", required=True)
    db_sub.add_parser("init", help="Create tables if missing (idempotent)")

    imp = sub.add_parser("import", help="Import catalog or CV data")
    imp_sub = imp.add_subparsers(dest="kind", required=True)

    prod = imp_sub.add_parser("products", help="Product MDM export")
    prod.add_argument("--file", type=Path, help="Path to .xlsx or .csv")
    prod.add_argument("--xlsx", type=Path, help=argparse.SUPPRESS)

    pkg = imp_sub.add_parser("packages", help="Solution package export")
    pkg.add_argument("--file", type=Path, help="Path to .xlsx or .csv")
    pkg.add_argument("--xlsx", type=Path, help=argparse.SUPPRESS)

    pair = imp_sub.add_parser(
        "catalog",
        help="Import both product and package exports in one transaction",
    )
    pair.add_argument("--products", type=Path, required=True)
    pair.add_argument("--packages", type=Path, required=True)

    people = imp_sub.add_parser("people", help="Team directory JSON")
    people.add_argument("--json", type=Path, required=True)
    people.add_argument("--file", type=Path, help=argparse.SUPPRESS)

    keys = sub.add_parser("keys", help="Manage API keys")
    keys_sub = keys.add_subparsers(dest="keys_cmd", required=True)
    create = keys_sub.add_parser("create")
    create.add_argument("--label", required=True)
    create.add_argument("--scopes", default=f"{SCOPE_MCP_CATALOG},{SCOPE_MCP_CV}")
    create.add_argument("--bus", default="", help="Comma-separated business units")
    create.add_argument("--all-bus", action="store_true")
    keys_sub.add_parser("list")
    revoke = keys_sub.add_parser("revoke")
    revoke.add_argument("--id", required=True)

    args = parser.parse_args()

    if args.command == "db" and args.db_cmd == "init":
        init_db()
        print("Database schema ready (create_all).")
        return

    init_db()

    if args.command == "serve":
        base = resolve_avatar_public_base_url(get_settings())
        if base:
            print(f"Avatar URL base: {base}")
        uvicorn.run(
            "proposal_knowledge.interfaces.http.app:app",
            host=args.host,
            port=args.port,
            reload=False,
        )
        return

    if args.command == "import":
        if args.kind == "catalog":
            with session_scope() as session:
                n_prod, n_pkg = import_catalog_pair(
                    session,
                    products_path=args.products,
                    packages_path=args.packages,
                )
            print(f"Imported {n_prod} products, {n_pkg} packages")
            return
        path = _resolve_import_path(args)
        with session_scope() as session:
            if args.kind == "products":
                n = import_products_file(session, path)
            elif args.kind == "packages":
                n = import_packages_file(session, path)
            else:
                n = import_people_json(session, path)
        print(f"Imported {n} rows from {path}")
        return

    if args.command == "keys":
        if args.keys_cmd == "create":
            scopes = [s.strip() for s in args.scopes.split(",") if s.strip()]
            bus = [b.strip() for b in args.bus.split(",") if b.strip()] or None
            with session_scope() as session:
                row, raw = create_api_key_record(
                    session,
                    label=args.label,
                    scopes=scopes,
                    allowed_business_units=bus,
                    allow_all_business_units=args.all_bus,
                )
            print("API key (store securely, shown once):")
            print(raw)
            print(f"id={row.id} prefix={row.key_prefix}")
            return
        if args.keys_cmd == "list":
            with session_scope() as session:
                for row in list_api_keys(session):
                    print(
                        f"{row.id}\t{row.label}\t{row.key_prefix}\t"
                        f"revoked={bool(row.revoked_at)}\tbus={row.allowed_business_units}"
                    )
            return
        if args.keys_cmd == "revoke":
            with session_scope() as session:
                ok = revoke_api_key(session, args.id)
            if not ok:
                print("Not found or already revoked", file=sys.stderr)
                sys.exit(1)
            print("Revoked")
            return

    parser.print_help()


if __name__ == "__main__":
    main()
