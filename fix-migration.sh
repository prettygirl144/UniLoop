#!/bin/bash
cd /home/runner/workspace

# Try to complete the migration with automated responses
{
  echo "create table"
  echo "create table" 
  echo "create table"
  echo "create table"
  echo "create table"
  sleep 2
} | timeout 60s drizzle-kit push

echo "Migration script completed"