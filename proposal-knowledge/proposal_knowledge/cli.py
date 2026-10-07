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
from proposal_knowledge.application.backfill_jurisdictions import (
    backfill_empty_product_jurisdictions,
    patch_acorp_sg_offshore_jurisdictions,
)
from proposal_knowledge.application.import_catalog import (
    import_catalog_pair,
    import_packages_file,
    import_products_file,
    purge_business_units_by_prefix,
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

    def add_sanitize_flag(p: argparse.ArgumentParser) -> None:
        p.add_argument(
            "--sanitize-acorp",
            action="store_true",
            help="Rewrite INCORP-* to Acorp-* and incorp → Acorp in text fields",
        )

    prod = imp_sub.add_parser("products", help="Product MDM export")
    prod.add_argument("--file", type=Path, help="Path to .xlsx or .csv")
    prod.add_argument("--xlsx", type=Path, help=argparse.SUPPRESS)
    add_sanitize_flag(prod)

    pkg = imp_sub.add_parser("packages", help="Solution package export")
    pkg.add_argument("--file", type=Path, help="Path to .xlsx or .csv")
    pkg.add_argument("--xlsx", type=Path, help=argparse.SUPPRESS)
    add_sanitize_flag(pkg)

    pair = imp_sub.add_parser(
        "catalog",
        help="Import both product and package exports in one transaction",
    )
    pair.add_argument("--products", type=Path, required=True)
    pair.add_argument("--packages", type=Path, required=True)
    add_sanitize_flag(pair)

    purge = imp_sub.add_parser(
        "purge-bu-prefix",
        help="Delete catalog rows where business_unit starts with prefix",
    )
    purge.add_argument("--prefix", required=True, help="e.g. INCORP-")

    bf = imp_sub.add_parser(
        "backfill-jurisdictions",
        help="Set default jurisdiction on products with empty Jurisdictions (Acorp-XX → XX)",
    )
    bf.add_argument(
        "--apply",
        action="store_true",
        help="Write changes (default is dry-run counts only)",
    )

    sg_off = imp_sub.add_parser(
        "patch-acorp-sg-offshore-jurisdictions",
        help="Acorp-SG only: BVI SKUs → VG, Cayman SKUs → KY",
    )
    sg_off.add_argument(
        "--apply",
        action="store_true",
        help="Write changes (default is dry-run counts only)",
    )

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
        sanitize = getattr(args, "sanitize_acorp", False)
        if args.kind == "purge-bu-prefix":
            with session_scope() as session:
                n_prod, n_pkg = purge_business_units_by_prefix(session, args.prefix)
            print(f"Purged {n_prod} products, {n_pkg} packages (prefix {args.prefix!r})")
            return
        if args.kind == "backfill-jurisdictions":
            with session_scope() as session:
                stats = backfill_empty_product_jurisdictions(
                    session, apply=args.apply
                )
            mode = "applied" if args.apply else "dry-run"
            print(f"backfill-jurisdictions ({mode}):")
            for k in sorted(stats):
                print(f"  {k}: {stats[k]}")
            return
        if args.kind == "patch-acorp-sg-offshore-jurisdictions":
            with session_scope() as session:
                stats = patch_acorp_sg_offshore_jurisdictions(
                    session, apply=args.apply
                )
            mode = "applied" if args.apply else "dry-run"
            print(f"patch-acorp-sg-offshore-jurisdictions ({mode}):")
            for k in sorted(stats):
                print(f"  {k}: {stats[k]}")
            return
        if args.kind == "catalog":
            with session_scope() as session:
                n_prod, n_pkg = import_catalog_pair(
                    session,
                    products_path=args.products,
                    packages_path=args.packages,
                    sanitize_acorp=sanitize,
                )
            print(f"Imported {n_prod} products, {n_pkg} packages")
            return
        path = _resolve_import_path(args)
        with session_scope() as session:
            if args.kind == "products":
                n = import_products_file(session, path, sanitize_acorp=sanitize)
            elif args.kind == "packages":
                n = import_packages_file(session, path, sanitize_acorp=sanitize)
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
                key_id = row.id
                prefix = row.key_prefix
            print("API key (store securely, shown once):")
            print(raw)
            print(f"id={key_id} prefix={prefix}")
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
